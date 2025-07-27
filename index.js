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
        case 'waiting_for_transfer_station': // ★ 乗り換え駅を待つ状態を追加
            return handleTransferStation(event, userId, user.temp_departure_station, user.temp_arrival_station, text);
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
    // ... (この関数は変更なし)
}

/**
 * 地域登録後、出発駅を質問する
 */
async function handleAreaRegistration(event, userId, cityName) {
    // ... (この関数は変更なし)
}

/**
 * 出発駅の登録を処理する
 */
async function handleDepartureStation(event, userId, stationName) {
    // ... (この関数は変更なし)
}

/**
 * ★ [修正] 到着駅を受け取り、路線を検索。乗り換えも考慮する
 */
async function handleArrivalStation(event, userId, departureStation, arrivalStation) {
    console.log(`ユーザー (${userId}) の到着駅登録処理: ${arrivalStation}`);
    const arrivalStationClean = arrivalStation.replace(/駅$/, '');
    try {
        // ★ 共通路線を検索するヘルパー関数を呼び出す
        const commonLines = await findCommonLines(departureStation, arrivalStationClean);

        if (commonLines.length > 0) {
            // ★ 直通路線が見つかった場合
            console.log(`直通路線を発見: ${commonLines.join(', ')}`);
            await pool.query("UPDATE users SET temp_arrival_station = $1, conversation_state = 'waiting_for_line_selection' WHERE user_id = $2", [arrivalStationClean, userId]);
            return sendLineSelectionFlexMessage(event.replyToken, commonLines, `「${departureStation}」→「${arrivalStationClean}」の路線`);
        } else {
            // ★ 直通路線がない場合、乗り換え駅を質問する
            console.log('直通路線が見つかりません。乗り換え駅を質問します。');
            await pool.query("UPDATE users SET temp_arrival_station = $1, conversation_state = 'waiting_for_transfer_station' WHERE user_id = $2", [arrivalStationClean, userId]);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、その2つの駅を直接結ぶ路線が見つからへんかったわ。\n乗り換えが必要みたいやな。一番よう使う乗り換え駅を1つだけ教えてくれるか？（例：池袋）' });
        }
    } catch (error) {
        console.error('路線情報の取得でエラー:', error.message);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: error.message || 'すまん、路線の情報を取得するのに失敗したわ…。もう一回、出発駅から教えてくれるか？' });
    }
}

/**
 * ★ [新規] 乗り換え駅を受け取り、複数区間の路線を検索する
 */
async function handleTransferStation(event, userId, departureStation, arrivalStation, transferStation) {
    console.log(`ユーザー (${userId}) の乗り換え駅登録処理: ${transferStation}`);
    const transferStationClean = transferStation.replace(/駅$/, '');
    try {
        const lines1 = await findCommonLines(departureStation, transferStationClean);
        const lines2 = await findCommonLines(transferStationClean, arrivalStation);

        const allLines = [...new Set([...lines1, ...lines2])]; // 配列を結合し、重複を削除

        if (allLines.length === 0) {
            await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、乗り換え駅を使ってもうまいこと路線が見つけられへんかった…。駅名が違うかもしれんから、もう一回、出発駅から教えてな。' });
        }
        
        console.log(`乗り換え路線を発見: ${allLines.join(', ')}`);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_line_selection' WHERE user_id = $1", [userId]);
        return sendLineSelectionFlexMessage(event.replyToken, allLines, `「${departureStation}」→「${transferStationClean}」→「${arrivalStation}」の路線`);

    } catch (error) {
        console.error('乗り換え路線情報の取得でエラー:', error.message);
        await pool.query("UPDATE users SET conversation_state = 'waiting_for_departure_station' WHERE user_id = $1", [userId]);
        return client.replyMessage(event.replyToken, { type: 'text', text: error.message || 'すまん、乗り換え路線の情報を取得するのに失敗したわ…。もう一回、出発駅から教えてくれるか？' });
    }
}

/**
 * ★ [新規] 2駅間の共通路線を検索するヘルパー関数
 */
async function findCommonLines(station1, station2) {
    const [promise1, promise2] = await Promise.all([
        axios.get(`http://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(station1)}`),
        axios.get(`http://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(station2)}`)
    ]);

    const stations1 = promise1.data.response.station;
    const stations2 = promise2.data.response.station;

    if (!stations1 || !stations2) {
        let errorMessage = '';
        if (!stations1) errorMessage += `「${station1}」っちゅう駅、ほんまにあるか？\n`;
        if (!stations2) errorMessage += `「${station2}」っちゅう駅、ほんまにあるか？\n`;
        throw new Error(errorMessage || '駅情報の取得に失敗しました。');
    }

    const getLinesSet = (stations) => {
        const lines = new Set();
        if (stations) {
            stations.forEach(s => {
                if (Array.isArray(s.line)) {
                    s.line.forEach(l => l && lines.add(l.trim()));
                } else if (s.line) {
                    lines.add(s.line.trim());
                }
            });
        }
        return lines;
    };

    const lines1 = getLinesSet(stations1);
    const lines2 = getLinesSet(stations2);
    
    return Array.from(lines1).filter(line => lines2.has(line));
}

/**
 * ★ [新規] 路線選択のFlex Messageを送信する共通関数
 */
async function sendLineSelectionFlexMessage(replyToken, lines, title) {
    const buttons = lines.map(line => ({
        type: 'button',
        action: {
            type: 'postback',
            label: line,
            data: `action=toggle_line&line=${encodeURIComponent(line)}`
        },
        style: 'primary',
        margin: 'sm',
        height: 'sm',
    }));
    
    buttons.push({
        type: 'button',
        action: { type: 'postback', label: 'この中にない（手動入力）', data: 'action=add_manually' },
        style: 'secondary',
        margin: 'md',
        height: 'sm',
    });
    buttons.push({
        type: 'button',
        action: { type: 'postback', label: '完了', data: 'action=finish_lines' },
        style: 'primary',
        color: '#00B900',
        margin: 'sm',
        height: 'sm',
    });

    const flexMessage = {
        type: 'flex',
        altText: '路線の選択',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [{ type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true }]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: '毎朝チェックする路線を全部選んで「完了」を押してな。\n(ボタンを押すたびに追加／削除が切り替わるで)', wrap: true }
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
    return client.replyMessage(replyToken, flexMessage);
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
 * Postbackイベント（ボタンクリック）を処理する
 */
async function handlePostbackEvent(event, userId) {
    // ... (この関数は変更なし)
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
    // ... (この関数は変更なし)
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
