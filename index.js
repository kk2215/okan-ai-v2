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
    // --- 1. ユーザーIDを取得 ---
    const userId = event.source.userId;
    if (!userId) {
        return Promise.resolve(null);
    }

    // --- 2. イベントタイプによる分岐 ---
    // 友だち追加 (フォロー) イベント
    if (event.type === 'follow') {
        return handleFollowEvent(event, userId);
    }

    // メッセージイベント以外は処理しない
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const text = event.message.text.trim();

    // --- 3. ユーザーの状態をDBから取得 ---
    const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    let user;

    // DBにユーザーが存在しない場合 (ブロック→再追加などでフォローイベントが検知できない場合の保険)
    if (userResult.rows.length === 0) {
        console.log(`DBにいないユーザー (${userId}) を検知。初期登録フローを開始します。`);
        return handleFollowEvent(event, userId); // フォローイベントと同じ処理を呼び出す
    } else {
        user = userResult.rows[0];
    }
    
    const state = user.conversation_state;

    // --- 4. 会話の状態に応じた処理の呼び出し ---
    switch (state) {
        case 'waiting_for_area':
            return handleAreaRegistration(event, userId, text);
        // case 'waiting_for_notification_time':
        //     return handleNotificationTimeRegistration(event, userId, text);
        // ★ 他の初期設定フローがあればここに追加
        default:
            // 初期設定完了後の通常会話モード
            break;
    }

    // --- 5. キーワードに応じた機能の呼び出し (通常会話モード) ---
    if (text.includes('リマインド') || text.includes('りまいんど')) {
        return handleReminder(event, userId, text);
    }
    // ★ 他のキーワードで反応する機能があればここに追加
    // (例: if (text.includes('ご飯')) { ... })

    return Promise.resolve(null); // どの条件にも合致しない場合は何もしない
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
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_area' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: welcomeBackMessage });
    }
}

/**
 * 地域登録を処理する (状態に基づいて呼び出される)
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

            const nextState = 'setup_completed'; 
            await pool.query(
                'UPDATE users SET lat = $1, lon = $2, area_name = $3, conversation_state = $4 WHERE user_id = $5',
                [lat, lon, japaneseName, nextState, userId]
            );

            console.log(`ユーザー (${userId}) の地域を ${japaneseName} に設定しました。`);
            
            const replyText = `${japaneseName}やな、了解やで！\nこれで初期設定は終わりや。これからよろしくな！\n\n「1時間後に会議 リマインド」みたいに話しかけてみてな。`;

            return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
        } else {
            console.log(`地域が見つかりませんでした: ${cityName}`);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その場所が見つけられへんかったわ…。もう一回、市区町村名だけで教えてくれるか？（例：豊島区）' });
        }
    } catch (error) {
        console.error('地域登録でエラー:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、天気情報のAPIで問題が起きたみたいや。ちょっと時間をおいてから、もう一回試してみてな。' });
    }
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
        // テーブルが存在しないエラーは起動時に修復されるので、ログレベルを下げても良い
        if (error.code === '42P01') { 
            console.log('checkAndSendReminders: remindersテーブルがまだ作成されていません。');
        } else {
            console.error('リマインダーの送信中にエラーが発生しました:', error);
        }
    }
}

// node-cronで毎分リマインダーチェックを実行
cron.schedule('* * * * *', () => {
  checkAndSendReminders();
});

//======================================================================
// ★ アプリ起動時の処理 & DB自動修復
//======================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
    // ★★★ 起動時にデータベースのテーブル構造をチェック・修正する ★★★
    setupDatabase();
});

/**
 * [変更] 起動時にDBのテーブルと列を網羅的にチェックし、なければ作成する関数
 */
async function setupDatabase() {
    console.log('データベースのスキーマをチェック・セットアップしています...');
    const client = await pool.connect();
    try {
        // --- 1. 'users' テーブルのチェックと作成 ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'users' テーブルの存在を確認しました。");

        // --- 2. 'users' テーブルの必須カラムを一つずつチェックして追加 ---
        const usersColumns = {
            conversation_state: 'TEXT',
            lat: 'NUMERIC',
            lon: 'NUMERIC',
            area_name: 'TEXT'
        };

        for (const [column, type] of Object.entries(usersColumns)) {
            const res = await client.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name=$1
            `, [column]);
            if (res.rows.length === 0) {
                console.log(`'users'テーブルに列 "${column}" が見つかりません。追加します...`);
                await client.query(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
                console.log(`列 "${column}" の追加に成功しました。`);
            }
        }
         console.log("'users' テーブルのカラムを正常にチェックしました。");


        // --- 3. 'reminders' テーブルのチェックと作成 ---
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
        console.log("'reminders' テーブルの存在を確認しました。");

        console.log('データベースのセットアップチェックが完了しました。');

    } catch (err) {
        console.error('データベースのセットアップ中に致命的なエラーが発生しました:', err);
    } finally {
        // 必ず接続をプールに返す
        client.release();
    }
}
