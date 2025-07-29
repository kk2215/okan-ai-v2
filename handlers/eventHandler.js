// handlers/eventHandler.js - LINEからのイベントを振り分ける受付担当

const handleFollow = require('./handleFollow');
const handleMessage = require('./handleMessage');
const handlePostback = require('./handlePostback'); // この行を追加

/**
 * イベントの種類に応じて適切な処理を呼び出す
 * @param {object} event - LINEのイベントオブジェクト
 * @param {object} client - LINEのクライアントインスタンス
 */
async function handleEvent(event, client) {
    console.log(`Received event: ${event.type}`);

    switch (event.type) {
        case 'follow':
            return handleFollow(event, client);

        case 'message':
            if (event.message.type === 'text') {
                return handleMessage(event, client);
            }
            break;

        // ボタンが押された時の処理を追加
        case 'postback':
            return handlePostback(event, client);

        default:
            return Promise.resolve(null);
    }
}

module.exports = handleEvent;
