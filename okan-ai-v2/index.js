// index.js - おかんAIの司令塔

const express = require('express');
const line = require('@line/bot-sdk');
const { initializeApp, getClient } = require('./services/lineClient');
const { initializeDb } = require('./services/firestore');
const { initializeScheduler } = require('./scheduler');
const handleEvent = require('./handlers/eventHandler');

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

initializeApp(config);
initializeDb();
initializeScheduler();

const app = express();

// ★★★ これがほんまの最後の修正や！見張り番専用の呼び鈴を、ここに付け直す！ ★★★
app.get('/health', (req, res) => {
    try {
        res.status(200).send('OK');
        console.log('見張り番から生存確認が来たで！元気やで！');
    } catch (error) {
        res.status(500).send('Error');
    }
});


// LINEからの連絡は、今まで通りこっちで受け取る
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Okan AI is listening on port ${port}...`);
    console.log('おかん、起動したわよ！いつでもおいで！');
});
