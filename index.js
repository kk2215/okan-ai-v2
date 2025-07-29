'use strict';

// 必要なライブラリをインポート
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { Pool } = require('pg');
const axios =require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const chrono = require('chrono-node');
const { utcToZonedTime, zonedTimeToUtc, format } = require('date-fns-tz');

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
        case 'waiting_for_notification_time':
            return handleNotificationTime(event, userId, text);
        case 'waiting_for_off_days':
            return handleOffDays(event, userId, text);
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
    if (text.includes('今日の晩ごはん') || text.includes('お腹すいた')) {
        return handleDinnerRequest(userId);
    }
    if (text.includes('買い物') || text.includes('食材') || text.includes('ミールキット')) {
        return askCookingTime(userId);
    }
    
    // どの条件にも合致しない場合、簡単な応答を返す
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'なんや？\n「リマインド」とか「今日の晩ごはん」とか、何か用事があったら言うてな。'
    });
}


//======================================================================
// ★ 機能ごとの関数
//======================================================================

/**
 * 友だち追加 (フォロー) イベントを処理する
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
        // 既存の設定をクリアして最初から
        await Promise.all([
            pool.query("UPDATE users SET conversation_state = 'waiting_for_area', last_notified_date = NULL, cooking_support_enabled = false WHERE user_id = $1", [userId]),
            pool.query("DELETE FROM train_routes WHERE user_id = $1", [userId]),
            pool.query("DELETE FROM garbage_days WHERE user_id = $1", [userId])
        ]);
        return client.replyMessage(event.replyToken, { type: 'text', text: welcomeBackMessage });
    }
}

/**
 * 地域登録で、候補が複数ある場合は重複を除外して選択肢を提示する
 */
async function handleAreaRegistration(event, userId, cityName) {
    console.log(`ユーザー (${userId}) の地域登録処理: ${cityName}`);
    try {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY is not set.');
        
        const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)},JP&limit=5`;
        const geoResponse = await axios.get(geoUrl, { params: { appid: apiKey } });
        
        if (!geoResponse.data || geoResponse.data.length === 0) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その場所が見つけられへんかったわ…。もう一回、市区町村名だけで教えてくれるか？（例：豊島区）' });
        }

        // 重複する地域の候補を除外する
        const uniqueLocations = [];
        const seen = new Set();
        for (const loc of geoResponse.data) {
            if (loc.local_names && loc.local_names.ja) {
                const stateName = loc.state || '';
                const uniqueKey = `${loc.local_names.ja},${stateName}`;
                if (!seen.has(uniqueKey)) {
                    seen.add(uniqueKey);
                    uniqueLocations.push(loc);
                }
            }
        }

        if (uniqueLocations.length === 1) {
            // 候補が1つの場合はそのまま登録
            return registerAreaAndProceed(event.replyToken, userId, uniqueLocations[0]);
        } else {
            // 候補が複数の場合は選択肢を提示
            const buttons = uniqueLocations.map(loc => {
                const stateName = loc.state || '';
                const displayName = `${loc.local_names.ja}, ${stateName}`;
                return {
                    type: 'button',
                    action: {
                        type: 'postback',
                        label: displayName,
                        data: `action=select_area&lat=${loc.lat}&lon=${loc.lon}&name=${encodeURIComponent(loc.local_names.ja)}&state=${encodeURIComponent(stateName)}`
                    },
                    style: 'primary',
                    margin: 'sm',
                    height: 'sm'
                };
            });

            const flexMessage = {
                type: 'flex',
                altText: '地域の選択',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [{ type: 'text', text: 'どこのことやろか？', weight: 'bold', size: 'lg' }]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [{ type: 'text', text: '同じ名前の場所がいくつか見つかったで。あんたが住んでるところを選んでな。', wrap: true }]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        contents: buttons
                    }
                }
            };
            await pool.query("UPDATE users SET conversation_state = 'waiting_for_area_selection' WHERE user_id = $1", [userId]);
            return client.replyMessage(event.replyToken, flexMessage);
        }
    } catch (error) {
        console.error('地域登録処理でエラー:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、情報の取得で問題が起きたみたいや。ちょっと時間をおいてから、もう一回試してみてな。' });
    }
}

/**
 * 地域情報をDBに登録し、確認メッセージと共に次のステップに進む共通関数
 */
async function registerAreaAndProceed(replyToken, userId, location) {
    const { lat, lon } = location;
    const japaneseName = (location.local_names && location.local_names.ja) || location.name;
    const stateName = location.state || '';

    await pool.query(
        'UPDATE users SET lat = $1, lon = $2, area_name = $3, conversation_state = $4 WHERE user_id = $5',
        [lat, lon, japaneseName, 'waiting_for_notification_time', userId]
    );

    console.log(`ユーザー (${userId}) の地域を ${stateName} ${japaneseName} に設定しました。`);
    const replyText = `${stateName ? stateName + 'の' : ''}${japaneseName}やな、了解やで！\n次は毎朝の通知は何時がええか教えてな。（例：8:00）`;
    return client.replyMessage(replyToken, { type: 'text', text: replyText });
}


/**
 * 通知時間の設定を処理する
 */
async function handleNotificationTime(event, userId, text) {
    const results = chrono.ja.parse(text);

    if (results.length === 0) {
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、うまく時間が聞き取れへんかったわ。「8時」とか「午前7時半」みたいにもう一回教えてくれるか？' });
    }

    const date = results[0].start.date();
    const formattedTime = format(date, 'HH:mm', { timeZone: JST });

    await pool.query("UPDATE users SET notification_time = $1, conversation_state = 'waiting_for_off_days' WHERE user_id = $2", [formattedTime, userId]);
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `毎朝${formattedTime}やな、了解や！\n通知が要らん曜日はあるか？\n「土日」とか「水曜」みたいに教えてな。なければ「なし」でええで。`
    });
}

/**
 * 通知オフの曜日を自然言語で登録する
 */
async function handleOffDays(event, userId, text) {
    const dayMap = {
        '月': 'Monday', '火': 'Tuesday', '水': 'Wednesday', '木': 'Thursday', '金': 'Friday', '土': 'Saturday', '日': 'Sunday',
        'げつ': 'Monday', 'か': 'Tuesday', 'すい': 'Wednesday', 'もく': 'Thursday', 'きん': 'Friday', 'ど': 'Saturday', 'にち': 'Sunday'
    };
    const offDays = new Set();
    let found = false;

    if (['なし', 'ない', '毎日'].includes(text)) {
        await pool.query("UPDATE users SET notification_off_days = '[]', conversation_state = 'waiting_for_garbage_day' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: '了解や！毎日通知するな！\n最後にゴミの日を教えてな。「燃えるゴミは月曜と木曜」みたいに教えてくれると助かるわ。登録せん場合は「なし」と入力してや。' });
    }

    for (const [key, value] of Object.entries(dayMap)) {
        if (text.includes(key)) {
            offDays.add(value);
            found = true;
        }
    }

    if (!found) {
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、うまく聞き取れへんかったわ。「土日」とか「水曜」みたいにもう一回教えてくれるか？' });
    }

    const offDaysArray = Array.from(offDays);
    const offDaysJapanese = offDaysArray.map(day => {
        const entry = Object.entries(dayMap).find(([_, val]) => val === day);
        return entry ? entry[0] + '曜' : '';
    }).filter(Boolean).join('、');

    await pool.query("UPDATE users SET notification_off_days = $1, conversation_state = 'waiting_for_garbage_day' WHERE user_id = $2", [JSON.stringify(offDaysArray), userId]);
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `ほな、【${offDaysJapanese}】は通知せんようにしとくな！\n最後にゴミの日を教えてな。「燃えるゴミは月曜と木曜」みたいに教えてくれると助かるわ。登録せん場合は「なし」と入力してや。`
    });
}


/**
 * ゴミの日登録を処理する
 */
async function handleGarbageDayRegistration(event, userId, text) {
    const skipWords = ['なし', 'ない', 'スキップ', 'いらない'];
    if (skipWords.includes(text)) {
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_cooking_support_opt_in' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ゴミの日は登録せんのやな、了解や！\n基本的な設定はこれで終わりや！\nところで、毎週おかんが献立の相談に乗ったり、お買いもんの提案してもええか？',
            quickReply: { items: [
                { type: 'action', action: { type: 'postback', label: 'お願いする！', data: 'action=opt_in_cooking' }},
                { type: 'action', action: { type: 'postback', label: '自分でやるから大丈夫', data: 'action=opt_out_cooking' }}
            ]}
        });
    }
    
    console.log(`ユーザー (${userId}) のゴミの日登録処理: ${text}`);
    try {
        await pool.query('DELETE FROM garbage_days WHERE user_id = $1', [userId]);

        const dayMap = { '月': '月曜日', '火': '火曜日', '水': '水曜日', '木': '木曜日', '金': '金曜日', '土': '土曜日', '日': '日曜日' };
        const registered = [];
        const garbageDayRegex = /(.+?)(は|:|：)\s*([月火水木金土日、・\s]+)/g;
        let match;

        while ((match = garbageDayRegex.exec(text)) !== null) {
            const garbageType = match[1].trim();
            const daysPart = match[3];
            
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
                    if (!regEntry.days.includes(dayOfWeek)) {
                        regEntry.days.push(dayOfWeek);
                    }
                }
            }
        }
        
        if (registered.length === 0) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、うまく聞き取れへんかったわ。\n「燃えるゴミは月曜と木曜」みたいにもう一回教えてくれるか？登録せん場合は「なし」と入力してや。' });
        }

        let confirmation = 'ゴミの日、覚えたで！\n';
        registered.forEach(r => {
            confirmation += `・${r.type}: ${r.days.join('、')}\n`;
        });
        
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_cooking_support_opt_in' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: confirmation + '\n基本的な設定はこれで終わりや！\nところで、毎週おかんが献立の相談に乗ったり、お買いもんの提案してもええか？',
            quickReply: { items: [
                { type: 'action', action: { type: 'postback', label: 'お願いする！', data: 'action=opt_in_cooking' }},
                { type: 'action', action: { type: 'postback', label: '自分でやるから大丈夫', data: 'action=opt_out_cooking' }}
            ]}
        });

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

    // 地域選択の処理
    if (action === 'select_area') {
        const lat = parseFloat(data.get('lat'));
        const lon = parseFloat(data.get('lon'));
        const name = decodeURIComponent(data.get('name'));
        const state = decodeURIComponent(data.get('state'));
        
        const location = { lat, lon, name, state };
        return registerAreaAndProceed(event.replyToken, userId, location);
    }
    
    // 自炊サポートのオプトイン/アウト処理
    if (action === 'opt_in_cooking') {
        await pool.query("UPDATE users SET cooking_support_enabled = true, conversation_state = 'setup_completed' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: '了解や！おかんがしっかりサポートするさかい、任しとき！\nこれからよろしくな！' });
    }
    if (action === 'opt_out_cooking') {
        await pool.query("UPDATE users SET cooking_support_enabled = false, conversation_state = 'setup_completed' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'そっか、偉いなあ！あんたなら大丈夫やな！\nでも、困ったらいつでも「今日の晩ごはん」て話しかけてな。相談乗るで！' });
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
            notification_time: 'TIME',
            notification_off_days: 'TEXT',
            last_notified_date: 'DATE',
            cooking_support_enabled: 'BOOLEAN DEFAULT false'
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
