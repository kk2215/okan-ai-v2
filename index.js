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

    // ★ Postbackイベント（ボタンクリック）の処理を追加
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
    
    // ★ どの条件にも合致しない場合、簡単な応答を返す
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'なんや？\n「リマインド」とか「ご飯」とか、何か用事があったら言うてな。'
    });
}


//======================================================================
// ★ 機能ごとの関数
//======================================================================

/**
 * 友だち追加 (フォロー) イベントを処理する
 */
async function handleFollowEvent(event, userId) {
    // ... (この関数は変更なし)
}

/**
 * 地域登録を処理する
 */
async function handleAreaRegistration(event, userId, cityName) {
    // ... (この関数はほぼ変更なし、最後のメッセージと状態更新のみ変更)
    // ...
    // ★ 成功した場合、次のステップ（出発駅の質問）へ
    await pool.query(
        'UPDATE users SET lat = $1, lon = $2, area_name = $3, conversation_state = $4 WHERE user_id = $5',
        [lat, lon, japaneseName, 'waiting_for_departure_station', userId] // ★ 次の状態へ
    );
    const replyText = `${japaneseName}やな、了解やで！\n次は電車の運行状況を調べたいさかい、一番よう使う駅（出発駅）を教えてくれるか？（例：池袋）`;
    return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
    // ...
}

/**
 * ★ [新規] 出発駅の登録を処理する
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
 * ★ [新規] 到着駅の登録と路線選択ボタンの表示を処理する
 */
async function handleArrivalStation(event, userId, departureStation, arrivalStation) {
    console.log(`ユーザー (${userId}) の到着駅登録処理: ${arrivalStation}`);
    try {
        const response = await axios.get(`http://express.heartrails.com/api/json?method=getLines&station1=${encodeURIComponent(departureStation)}&station2=${encodeURIComponent(arrivalStation)}`);
        const lines = response.data.response.line;

        if (!lines) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その2つの駅を結ぶ路線が見つからへんかったわ。駅名を確認して、もう一回出発駅から教えてくれるか？' });
        }

        // 路線が1つでも配列になるように調整
        const lineArray = Array.isArray(lines) ? lines : [lines];

        const buttons = lineArray.map(line => ({
            type: 'button',
            action: {
                type: 'postback',
                label: line,
                data: `action=add_line&line=${line}`
            },
            style: 'primary',
            margin: 'sm'
        }));
        
        // 完了ボタンを追加
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
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、路線の情報を取得するのに失敗したわ…。もう一回、出発駅から教えてくれるか？' });
    }
}

/**
 * ★ [新規] ゴミの日登録を処理する
 */
async function handleGarbageDayRegistration(event, userId, text) {
    console.log(`ユーザー (${userId}) のゴミの日登録処理: ${text}`);
    try {
        // 既存のゴミの日設定を削除
        await pool.query('DELETE FROM garbage_days WHERE user_id = $1', [userId]);

        const dayMap = { '月': '月曜日', '火': '火曜日', '水': '水曜日', '木': '木曜日', '金': '金曜日', '土': '土曜日', '日': '日曜日' };
        const registered = [];

        const entries = text.split(/,|、/); // 「、」や「,」で区切る
        for (const entry of entries) {
            const parts = entry.split(/は|:/); // 「は」や「:」で区切る
            if (parts.length < 2) continue;

            const garbageType = parts[0].trim();
            const daysPart = parts[1];
            
            for (const char of daysPart) {
                if (dayMap[char]) {
                    const dayOfWeek = dayMap[char];
                    await pool.query(
                        'INSERT INTO garbage_days (user_id, garbage_type, day_of_week) VALUES ($1, $2, $3)',
                        [userId, garbageType, dayOfWeek]
                    );
                    if (!registered.find(r => r.type === garbageType)) {
                        registered.push({ type: garbageType, days: [] });
                    }
                    registered.find(r => r.type === garbageType).days.push(dayOfWeek);
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
 * ★ [新規] Postbackイベント（ボタンクリック）を処理する
 */
async function handlePostbackEvent(event, userId) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    if (action === 'add_line') {
        const lineName = data.get('line');
        console.log(`ユーザー (${userId}) が路線を追加: ${lineName}`);
        await pool.query('INSERT INTO train_routes (user_id, line_name) VALUES ($1, $2)', [userId, lineName]);
        // ボタンを押したことに対する応答は不要（押したことがわかるようにUIが変わるのが望ましいが、LINEの仕様上難しい）
        return Promise.resolve(null);
    }

    if (action === 'finish_lines') {
        console.log(`ユーザー (${userId}) が路線選択を完了しました。`);
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
    // ... (この関数は変更なし)
}

/**
 * 定期実行するリマインダー通知機能
 */
async function checkAndSendReminders() {
    // ... (この関数は変更なし)
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
            temp_departure_station: 'TEXT', // ★追加
            temp_arrival_station: 'TEXT'   // ★追加
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

        // --- 3. 'train_routes' テーブル (★新規) ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS train_routes (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                line_name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- 4. 'garbage_days' テーブル (★新規) ---
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
    // ... (この関数は変更なし)
}

// アプリケーションを起動
main().catch(err => {
    console.error('アプリケーションの起動に失敗しました:', err);
    process.exit(1);
});
