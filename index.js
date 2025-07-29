// index.js - おかんAIの司令塔 (Firebase版)

const express = require('express');
const line = require('@line/bot-sdk');
const { initializeApp, getClient } = require('./services/lineClient');
const { initializeDb } = require('./services/firestore');
const { initializeScheduler } = require('./scheduler'); // schedulerをインポート
const handleEvent = require('./handlers/eventHandler');

// --- 初期化処理 ---

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

initializeApp(config);
initializeDb();
initializeScheduler(); // スケジューラーを起動！

const app = express();

// --- Webhookエンドポイント ---
app.post('/webhook', line.middleware(config), (req, res) => {
    const handleRequest = async () => {
        try {
            await Promise.all(req.body.events.map(event => handleEvent(event, getClient())));
            res.json({});
        } catch (err) {
            console.error("Error processing events: ", err);
            res.status(500).end();
        }
    };
    handleRequest();
});

// --- サーバー起動 ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Okan AI is listening on port ${port}...`);
    console.log('おかん、起動したわよ！いつでもおいで！');
});
