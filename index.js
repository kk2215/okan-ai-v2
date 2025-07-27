'use strict';

// 必要なライブラリをインポート
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const chrono = require('chrono-node');
const { zonedTimeToUtc, utcToZonedTime, format } = require('date-fns-tz');

// LINEとデータベースの接続情報を設定
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const app = express();
const client = new Client(config);
const JST = 'Asia/Tokyo'; // 日本のタイムゾーン

//======================================================================
// Webhook / ルート設定
//======================================================================
app.get('/', (req, res) => {
    res.send('Okan AI is running!');
});

app.post('/webhook', middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});


//======================================================================
// ★ メインのイベント処理ハンドラ (司令塔)
//======================================================================
async function handleEvent(event) {
    const userId = event.source.userId;
    if (!userId) {
        return Promise.resolve(null);
    }

    // --- イベントタイプによる分岐 ---
    if (event.type === 'follow') {
        return handleFollowEvent(event, userId);
    }

    if (event.type === 'postback') {
        return handlePostbackEvent(event, userId);
    }

    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const text = event.message.text.trim();

    // --- ユーザーの状態をDBから取得 ---
    const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    let user;

    if (userResult.rows.length === 0) {
        console.log(`DBにいないユーザー (${userId}) を検知。初期登録フローを開始します。`);
        return handleFollowEvent(event, userId);
    } else {
        user = userResult.rows[0];
    }
    
    const state = user.conversation_state;

    // --- 会話の状態に応じた処理の呼び出し (初期設定フロー) ---
    switch (state) {
        case 'waiting_for_area':
            return handleAreaRegistration(event, userId, text);
        case 'waiting_for_departure_station':
            return handleDepartureStation(event, userId, text);
        case 'waiting_for_arrival_station':
            return handleArrivalStation(event, userId, user.temp_departure_station, text);
        case 'waiting_for_garbage_day':
            return handleGarbageDayRegistration(event, userId, text);
        default:
            // 初期設定完了後の通常会話モード
            break;
    }

    // --- キーワードに応じた機能の呼び出し (通常会話モード) ---
    if (text.includes('リマインド') || text.includes('りまいんど')) {
        return handleReminder(event, userId, text);
    }
    
    // どの条件にも合致しない場合、簡単な応答を返す
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'なんや？\n「リマインド」とか「ご飯」とか、何か用事があったら言うてな。'
    });
}


//======================================================================
// ★ 機能ごとの関数
//======================================================================

/**
 * [修正] 友だち追加 (フォロー) イベントを処理する
 */
async function handleFollowEvent(event, userId) {
    const userCheck = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);

    const welcomeMessage = '友達追加ありがとうな！\nあんたのこと、もっと知りたいさかい、いくつか質問させてな。\n\nまず、あんたが住んでる市区町村を教えてくれるか？（例：渋谷区）';
    const welcomeBackMessage = 'おかえり！また話せて嬉しいで！\n設定を最初から確認させてな。\n\nあんたが住んでる市区町村を教えてくれるか？（例：新宿区）';

    if (userCheck.rows.length === 0) {
        // 新規ユーザーの場合
        console.log(`新規ユーザー (${userId}) をDBに登録します。`);
        await pool.query("INSERT INTO users (user_id, conversation_state) VALUES ($1, 'waiting_for_area')", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: welcomeMessage });
    } else {
        // 再フォローの場合
        console.log(`既存ユーザー (${userId}) が再フォローしました。`);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_area' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: welcomeBackMessage });
    }
}

/**
 * [修正] 地域登録を処理する
 */
async function handleAreaRegistration(event, userId, cityName) {
    console.log(`ユーザー (${userId}) の地域登録処理: ${cityName}`);
    try {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
            console.error('OPENWEATHERMAP_API_KEYが設定されていません。');
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、おかんちょっと準備不足やったわ。また後で試してみてな。' });
        }
        const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)},JP&limit=1&appid=${apiKey}`;
        
        const response = await axios.get(url);
        
        if (response.data && response.data.length > 0) {
            const { lat, lon, local_names } = response.data[0];
            const japaneseName = (local_names && local_names.ja) ? local_names.ja : cityName;

            await pool.query(
                'UPDATE users SET lat = $1, lon = $2, area_name = $3, conversation_state = $4 WHERE user_id = $5',
                [lat, lon, japaneseName, 'waiting_for_departure_station', userId]
            );

            console.log(`ユーザー (${userId}) の地域を ${japaneseName} に設定しました。`);
            const replyText = `${japaneseName}やな、了解やで！\n次は電車の運行状況を調べたいさかい、一番よう使う駅（出発駅）を教えてくれるか？（例：池袋）`;
            return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
        } else {
            console.log(`地域が見つかりませんでした: ${cityName}`);
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'すまんな、その場所が見つけられへんかったわ…。もう一回、市区町村名だけで教えてくれるか？（例：豊島区）'
            });
        }
    } catch (error) {
        console.error('地域登録でエラー:', error);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'すまん、天気情報のAPIで問題が起きたみたいや。ちょっと時間をおいてから、もう一回試してみてな。'
        });
    }
}

/**
 * 出発駅の登録を処理する
 */
async function handleDepartureStation(event, userId, stationName) {
    console.log(`ユーザー (${userId}) の出発駅登録処理: ${stationName}`);
    await pool.query(
        "UPDATE users SET temp_departure_station = $1, conversation_state = 'waiting_for_arrival_station' WHERE user_id = $2",
        [stationName, userId]
    );
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${stationName}駅やな。ほな、職場とか学校の最寄り駅（到着駅）も教えてくれるか？（例：渋谷）`
    });
}

/**
 * 到着駅の登録と路線選択ボタンの表示を処理する
 */
async function handleArrivalStation(event, userId, departureStation, arrivalStation) {
    console.log(`ユーザー (${userId}) の到着駅登録処理: ${arrivalStation}`);
    try {
        const response = await axios.get(`http://express.heartrails.com/api/json?method=getLines&station1=${encodeURIComponent(departureStation)}&station2=${encodeURIComponent(arrivalStation)}`);
        const lines = response.data.response.line;

        if (!lines) {
            await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その2つの駅を結ぶ路線が見つからへんかったわ。駅名を確認して、もう一回出発駅から教えてくれるか？' });
        }

        const lineArray = Array.isArray(lines) ? lines : [lines];

        const buttons = lineArray.map(line => ({
            type: 'button',
            action: {
                type: 'postback',
                label: line,
                data: `action=add_line&line=${encodeURIComponent(line)}`
            },
            style: 'primary',
            margin: 'sm'
        }));
        
        buttons.push({
            type: 'button',
            action: {
                type: 'postback',
                label: 'これでOK',
                data: 'action=finish_lines'
            },
            style: 'secondary',
            margin: 'md'
        });

        const flexMessage = {
            type: 'flex',
            altText: '路線の選択',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [{ type: 'text', text: '利用する路線を選択', weight: 'bold', size: 'lg' }]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        { type: 'text', text: '毎朝チェックする路線を全部選んで、最後に「これでOK」を押してな。', wrap: true }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: buttons
                }
            }
        };

        await pool.query("UPDATE users SET conversation_state = 'waiting_for_line_selection' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, flexMessage);

    } catch (error) {
        console.error('路線情報の取得でエラー:', error);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、路線の情報を取得するのに失敗したわ…。もう一回、出発駅から教えてくれるか？' });
    }
}

/**
 * ゴミの日登録を処理する
 */
async function handleGarbageDayRegistration(event, userId, text) {
    console.log(`ユーザー (${userId}) のゴミの日登録処理: ${text}`);
    try {
        await pool.query('DELETE FROM garbage_days WHERE user_id = $1', [userId]);

        const dayMap = { '月': '月曜日', '火': '火曜日', '水': '水曜日', '木': '木曜日', '金': '金曜日', '土': '土曜日', '日': '日曜日' };
        const registered = [];

        const entries = text.split(/,|、|\n/).filter(e => e.trim() !== '');
        for (const entry of entries) {
            const parts = entry.split(/は|:|：/);
            if (parts.length < 2) continue;

            const garbageType = parts[0].trim();
            const daysPart = parts[1];
            
            let foundDay = false;
            for (const char of daysPart) {
                if (dayMap[char]) {
                    const dayOfWeek = dayMap[char];
                    await pool.query(
                        'INSERT INTO garbage_days (user_id, garbage_type, day_of_week) VALUES ($1, $2, $3)',
                        [userId, garbageType, dayOfWeek]
                    );
                    let regEntry = registered.find(r => r.type === garbageType);
                    if (!regEntry) {
                        regEntry = { type: garbageType, days: [] };
                        registered.push(regEntry);
                    }
                    regEntry.days.push(dayOfWeek.replace('曜日',''));
                    foundDay = true;
                }
            }
        }
        
        if (registered.length === 0) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、うまく聞き取れへんかったわ。\n「燃えるゴミは月曜と木曜、カンは水曜」みたいにもう一回教えてくれるか？' });
        }

        let confirmation = 'ゴミの日、覚えたで！\n';
        registered.forEach(r => {
            confirmation += `・${r.type}: ${r.days.join('、')}\n`;
        });
        confirmation += '\nこれで全部の設定が終わったで！これから毎日あんたをサポートするさかい、よろしくな！';

        await pool.query("UPDATE users SET conversation_state = 'setup_completed' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: confirmation });

    } catch (error) {
        console.error('ゴミの日登録でエラー:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、ゴミの日の登録で問題が起きたみたいや…。' });
    }
}


/**
 * Postbackイベント（ボタンクリック）を処理する
 */
async function handlePostbackEvent(event, userId) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    if (action === 'add_line') {
        const lineName = decodeURIComponent(data.get('line'));
        console.log(`ユーザー (${userId}) が路線を追加: ${lineName}`);
        // 既に登録されていないか確認
        const check = await pool.query('SELECT * FROM train_routes WHERE user_id = $1 AND line_name = $2', [userId, lineName]);
        if(check.rows.length === 0) {
            await pool.query('INSERT INTO train_routes (user_id, line_name) VALUES ($1, $2)', [userId, lineName]);
        }
        return Promise.resolve(null);
    }

    if (action === 'finish_lines') {
        console.log(`ユーザー (${userId}) が路線選択を完了しました。`);
        // 登録された路線があるか確認
        const check = await pool.query('SELECT * FROM train_routes WHERE user_id = $1', [userId]);
        if (check.rows.length === 0) {
            return client.pushMessage(userId, {type: 'text', text: '路線が1つも選ばれてへんで！どれか1つは選んでな。'});
        }

        await pool.query("UPDATE users SET conversation_state = 'waiting_for_garbage_day' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '路線、了解や！\n最後にゴミの日を教えてな。\n「燃えるゴミは月曜と木曜、カンは水曜」みたいに、まとめて教えてくれると助かるわ。'
        });
    }

    return Promise.resolve(null);
}


/**
 * リマインダー登録を処理する
 */
async function handleReminder(event, userId, text) {
    console.log(`ユーザー (${userId}) のリマインダー処理: ${text}`);
    try {
        const now = new Date();
        const zonedNow = utcToZonedTime(now, JST);
        const results = chrono.ja.parse(text, zonedNow, { forwardDate: true });

        if (results.length === 0) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'いつリマインドすればええんや？\n「明日の15時に会議」とか「30分後に買い物」みたいに、日時や時間を具体的に教えてな！' });
        }

        const reminderDateTime = results[0].start.date();
        const task = text.substring(0, results[0].index).trim() || text.substring(results[0].index + results[0].text.length).trim();

        if (!task) {
            return client.replyMessage(event.replyToken, { type: 'text', text: '何をリマインドすればええんや？\n「明日の15時に会議」みたいに、やることも一緒に教えてな！' });
        }

        const reminderTimeUtc = zonedTimeToUtc(reminderDateTime, JST);
        await pool.query('INSERT INTO reminders (user_id, task, reminder_time, created_at) VALUES ($1, $2, $3, NOW())', [userId, task, reminderTimeUtc]);
        
        const formattedDateTime = format(reminderDateTime, 'M月d日 HH:mm', { timeZone: JST });
        const replyText = `【リマインダー登録】\nわかったで！\n\n内容：${task}\n日時：${formattedDateTime}\n\n時間になったら教えるさかいな！`;

        return client.replyMessage(event.replyToken, { type: 'text', text: replyText });

    } catch (error) {
        console.error('リマインダーの処理中にエラーが発生しました:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、リマインダーの登録で問題が起きたみたいや。もう一回試してみてくれるか？' });
    }
}

/**
 * 定期実行するリマインダー通知機能
 */
async function checkAndSendReminders() {
    try {
        const nowUtc = new Date();
        const res = await pool.query("SELECT id, user_id, task, reminder_time FROM reminders WHERE reminder_time <= $1 AND notified = false", [nowUtc]);

        if (res.rows.length === 0) return;
        
        console.log(`${res.rows.length}件のリマインダーを送信します。`);
        for (const reminder of res.rows) {
            const zonedReminderTime = utcToZonedTime(reminder.reminder_time, JST);
            const formattedTime = format(zonedReminderTime, 'M月d日 HH:mm', { timeZone: JST });
            const message = { type: 'text', text: `【リマインダーの時間やで！】\n\n内容：${reminder.task}\n設定日時：${formattedTime}\n\n忘れたらあかんで〜！` };
            await client.pushMessage(reminder.user_id, message);
            await pool.query("UPDATE reminders SET notified = true WHERE id = $1", [reminder.id]);
            console.log(`リマインダー (ID: ${reminder.id}) をユーザー (${reminder.user_id}) に送信しました。`);
        }
    } catch (error) {
        if (error.code === '42P01') { 
            console.log('checkAndSendReminders: remindersテーブルがまだ作成されていません。');
        } else {
            console.error('リマインダーの送信中にエラーが発生しました:', error);
        }
    }
}

/**
 * DBのテーブルと列を網羅的にチェックし、なければ作成する関数
 */
async function setupDatabase() {
    console.log('データベースのスキーマをチェック・セットアップしています...');
    const client = await pool.connect();
    try {
        // --- 1. 'users' テーブル ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const usersColumns = {
            conversation_state: 'TEXT',
            lat: 'NUMERIC',
            lon: 'NUMERIC',
            area_name: 'TEXT',
            temp_departure_station: 'TEXT',
            temp_arrival_station: 'TEXT'
        };
        for (const [column, type] of Object.entries(usersColumns)) {
            const res = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=$1`, [column]);
            if (res.rows.length === 0) {
                await client.query(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
                console.log(`'users'テーブルに列 "${column}" を追加しました。`);
            }
        }

        // --- 2. 'reminders' テーブル ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                task TEXT NOT NULL,
                reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT false
            );
        `);

        // --- 3. 'train_routes' テーブル ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS train_routes (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                line_name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- 4. 'garbage_days' テーブル ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS garbage_days (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                garbage_type TEXT NOT NULL,
                day_of_week TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('データベースのセットアップチェックが完了しました。');

    } catch (err) {
        console.error('データベースのセットアップ中に致命的なエラーが発生しました:', err);
    } finally {
        client.release();
    }
}

//======================================================================
// ★ アプリケーションを安全な順序で起動する
//======================================================================
async function main() {
    // 1. まずデータベースのセットアップが完了するのを待つ
    await setupDatabase();

    // 2. データベースの準備ができてから、cronジョブをスケジュールする
    cron.schedule('* * * * *', () => {
        checkAndSendReminders();
    });
    console.log('リマインダーチェック用のcronジョブをスケジュールしました。');

    // 3. サーバーを起動する
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`listening on ${port}`);
    });
}

// アプリケーションを起動
main().catch(err => {
    console.error('アプリケーションの起動に失敗しました:', err);
    process.exit(1);
});
