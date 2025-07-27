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
        case 'waiting_for_transfer_station': // ★ 乗り換え駅を待つ状態
            return handleTransferStation(event, userId, text);
        case 'waiting_for_lines_manual':
            return handleLineRegistrationManual(event, userId, text);
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
            pool.query("UPDATE users SET conversation_state = 'waiting_for_area', temp_route_stations = NULL WHERE user_id = $1", [userId]),
            pool.query("DELETE FROM train_routes WHERE user_id = $1", [userId]),
            pool.query("DELETE FROM garbage_days WHERE user_id = $1", [userId])
        ]);
        return client.replyMessage(event.replyToken, { type: 'text', text: welcomeBackMessage });
    }
}

/**
 * 地域登録後、出発駅を質問する
 */
async function handleAreaRegistration(event, userId, cityName) {
    console.log(`ユーザー (${userId}) の地域登録処理: ${cityName}`);
    try {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY is not set.');
        
        const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)},JP&limit=1&appid=${apiKey}`;
        const geoResponse = await axios.get(geoUrl);
        
        if (!geoResponse.data || geoResponse.data.length === 0) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その場所が見つけられへんかったわ…。もう一回、市区町村名だけで教えてくれるか？（例：豊島区）' });
        }

        const { lat, lon, local_names } = geoResponse.data[0];
        const japaneseName = (local_names && local_names.ja) ? local_names.ja : cityName;

        await pool.query(
            'UPDATE users SET lat = $1, lon = $2, area_name = $3, conversation_state = $4 WHERE user_id = $5',
            [lat, lon, japaneseName, 'waiting_for_departure_station', userId]
        );

        console.log(`ユーザー (${userId}) の地域を ${japaneseName} に設定しました。`);
        const replyText = `${japaneseName}やな、了解やで！\n次は電車の運行状況を調べたいさかい、一番よう使う駅（出発駅）を教えてくれるか？（例：池袋）\n電車を使わへん場合は「なし」と入力してな。`;
        return client.replyMessage(event.replyToken, { type: 'text', text: replyText });

    } catch (error) {
        console.error('地域登録処理でエラー:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、情報の取得で問題が起きたみたいや。ちょっと時間をおいてから、もう一回試してみてな。' });
    }
}

/**
 * 出発駅の登録を処理する
 */
async function handleDepartureStation(event, userId, stationName) {
    if (stationName === 'なし') {
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_garbage_day' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '電車は使わへんのやな、了解や！\n最後にゴミの日を教えてな。\n「燃えるゴミは月曜と木曜、カンは水曜」みたいに、まとめて教えてくれると助かるわ。'
        });
    }

    console.log(`ユーザー (${userId}) の出発駅登録処理: ${stationName}`);
    const departureStation = stationName.replace(/駅$/, '');
    // ★ ルートの始点を保存
    await pool.query(
        "UPDATE users SET temp_route_stations = $1, conversation_state = 'waiting_for_arrival_station' WHERE user_id = $2",
        [JSON.stringify([departureStation]), userId]
    );
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${departureStation}駅やな。ほな、職場とか学校の最寄り駅（到着駅）も教えてくれるか？（例：渋谷）`
    });
}

/**
 * ★ [修正] 到着駅を受け取り、路線を検索。乗り換えも考慮する
 */
async function handleArrivalStation(event, userId, departureStation, arrivalStation) {
    console.log(`ユーザー (${userId}) の到着駅登録処理: ${arrivalStation}`);
    const arrivalStationClean = arrivalStation.replace(/駅$/, '');
    try {
        const commonLines = await findCommonLines(departureStation, arrivalStationClean);

        if (commonLines.length > 0) {
            // 直通路線が見つかった場合
            console.log(`直通路線を発見: ${commonLines.join(', ')}`);
            await pool.query("UPDATE users SET temp_route_stations = $1, conversation_state = 'waiting_for_line_selection' WHERE user_id = $2", [JSON.stringify([departureStation, arrivalStationClean]), userId]);
            return sendLineSelectionFlexMessage(event.replyToken, commonLines, `「${departureStation}」→「${arrivalStationClean}」の路線`);
        } else {
            // 直通路線がない場合、乗り換え駅を質問する
            console.log('直通路線が見つかりません。乗り換え駅を質問します。');
            await pool.query("UPDATE users SET temp_route_stations = $1, conversation_state = 'waiting_for_transfer_station' WHERE user_id = $2", [JSON.stringify([departureStation, arrivalStationClean]), userId]);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その2つの駅を直接結ぶ路線が見つからへんかったわ。\n乗り換えが必要みたいやな。一番よう使う乗り換え駅を1つだけ教えてくれるか？（例：池袋）' });
        }
    } catch (error) {
        console.error('路線情報の取得でエラー:', error.message);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: error.message || 'すまん、路線の情報を取得するのに失敗したわ…。もう一回、出発駅から教えてくれるか？' });
    }
}

/**
 * ★ [新規] 乗り換え駅を受け取り、さらに次の駅を質問するか、路線提案に進むか判断する
 */
async function handleTransferStation(event, userId, text) {
    const finishWords = ['完了', 'かんりょう', 'おわり', '終わり', 'ok', 'OK', 'ない', 'ないです'];
    const userResult = await pool.query('SELECT temp_route_stations FROM users WHERE user_id = $1', [userId]);
    const routeStations = JSON.parse(userResult.rows[0].temp_route_stations);

    // --- 乗り換え終了の場合 ---
    if (finishWords.includes(text)) {
        console.log(`乗り換え終了。最終ルート: ${routeStations.join(' → ')}`);
        const allLines = new Set();
        for (let i = 0; i < routeStations.length - 1; i++) {
            const lines = await findCommonLines(routeStations[i], routeStations[i+1]);
            lines.forEach(line => allLines.add(line));
        }

        if (allLines.size === 0) {
            await pool.query("UPDATE users SET conversation_state = 'waiting_for_lines_manual' WHERE user_id = $1", [userId]);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、うまいこと路線が見つけられへんかった…。お手数やけど、使う路線名を1つずつ入力して、終わったら「完了」と教えてな。' });
        }
        
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_line_selection' WHERE user_id = $1", [userId]);
        return sendLineSelectionFlexMessage(event.replyToken, Array.from(allLines), `「${routeStations.join('→')}」の路線`);
    }

    // --- 新しい乗り換え駅が追加された場合 ---
    const newTransferStation = text.replace(/駅$/, '');
    const lastStation = routeStations[routeStations.length - 2]; // 最後から2番目（現在の乗り換え元）
    
    // 新しい乗り換え駅が最終目的地と同じでないか確認
    const finalDestination = routeStations[routeStations.length - 1];
    if (newTransferStation === finalDestination) {
        return client.replyMessage(event.replyToken, { type: 'text', text: 'それは最終目的地やで！他になければ「完了」と教えてな。' });
    }

    // 新しい区間の路線をチェック
    const checkLines = await findCommonLines(lastStation, newTransferStation);
    if (checkLines.length === 0) {
        return client.replyMessage(event.replyToken, { type: 'text', text: `すまん、「${lastStation}」から「${newTransferStation}」への路線が見つからへんかったわ。駅名を確認してもう一回教えてくれるか？` });
    }

    // ルートの最後に新しい乗り換え駅を追加（最終目的地の前に追加）
    routeStations.splice(routeStations.length - 1, 0, newTransferStation);
    await pool.query('UPDATE users SET temp_route_stations = $1 WHERE user_id = $2', [JSON.stringify(routeStations), userId]);

    console.log(`乗り換え駅を追加。現在のルート: ${routeStations.join(' → ')}`);
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `「${newTransferStation}」駅やな、了解や。\n他にあれば次の乗り換え駅を、なければ「完了」と教えてな。`
    });
}


/**
 * 2駅間の共通路線を検索するヘルパー関数
 */
async function findCommonLines(station1, station2) {
    // ... (この関数は変更なし)
}

/**
 * 路線選択のFlex Messageを送信する共通関数
 */
async function sendLineSelectionFlexMessage(replyToken, lines, title) {
    // ... (この関数は変更なし)
}


/**
 * 手動での路線登録を処理する（実在確認付き）
 */
async function handleLineRegistrationManual(event, userId, text) {
    // ... (この関数は変更なし)
}


/**
 * ゴミの日登録を処理する
 */
async function handleGarbageDayRegistration(event, userId, text) {
    // ... (この関数は変更なし)
}


/**
 * ★ [修正] Postbackイベント（ボタンクリック）を処理する
 */
async function handlePostbackEvent(event, userId) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    // 路線ボタンのトグル（追加／削除）処理
    if (action === 'toggle_line') {
        const lineName = decodeURIComponent(data.get('line'));
        
        const check = await pool.query('SELECT * FROM train_routes WHERE user_id = $1 AND line_name = $2', [userId, lineName]);
        let replyText;
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM train_routes WHERE user_id = $1 AND line_name = $2', [userId, lineName]);
            console.log(`ユーザー (${userId}) が路線を削除 (ボタン): ${lineName}`);
            replyText = `「${lineName}」を取り消したで。`;
        } else {
            await pool.query('INSERT INTO train_routes (user_id, line_name) VALUES ($1, $2)', [userId, lineName]);
            console.log(`ユーザー (${userId}) が路線を追加 (ボタン): ${lineName}`);
            replyText = `「${lineName}」を追加したで！`;
        }
        // ★ ユーザーにフィードバックを返す
        await client.pushMessage(userId, { type: 'text', text: replyText });
        return Promise.resolve(null);
    }

    // 手動追加モードへの移行
    if (action === 'add_manually') {
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_lines_manual' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '了解や。追加したい路線名を1つずつ入力してな。終わったら「完了」と教えてや。'
        });
    }

    // 完了処理
    if (action === 'finish_lines') {
        const registeredLines = await pool.query('SELECT line_name FROM train_routes WHERE user_id = $1', [userId]);
        if (registeredLines.rows.length === 0) {
            return client.replyMessage(event.replyToken, {type: 'text', text: '路線が1つも選ばれてへんで！どれか1つは選んでな。'});
        }
        const lineNames = registeredLines.rows.map(r => r.line_name).join('、');
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_garbage_day' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `【${lineNames}】やな、覚えたで！\n最後にゴミの日を教えてな。\n「燃えるゴミは月曜と木曜、カンは水曜」みたいに、まとめて教えてくれると助かるわ。`
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
 * ★ [修正] DBのテーブルと列を網羅的にチェックし、なければ作成する関数
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
        // ★ 乗り換えルートを一時保存するカラムを追加
        const usersColumns = {
            conversation_state: 'TEXT',
            lat: 'NUMERIC',
            lon: 'NUMERIC',
            area_name: 'TEXT',
            temp_route_stations: 'TEXT' // JSON配列を文字列で保存
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
