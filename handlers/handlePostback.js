// handlers/handlePostback.js - ボタン押下（ポストバックイベント）の処理を担当

const { updateUserState, updateUserNotificationTime } = require('../services/user');
const { createAskTrainLineMessage } = require('../templates/askTrainLineMessage');

/**
 * ポストバックイベントを処理する
 * @param {object} event - LINEのポストバックイベントオブジェクト
 * @param {object} client - LINEのクライアントインスタンス
 */
async function handlePostback(event, client) {
    const userId = event.source.userId;
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    try {
        // 通知時間設定ボタンが押された場合
        if (action === 'set_notification_time') {
            const time = event.postback.params.time; // ユーザーが選んだ時間
            
            // 1. DBに時間を保存
            await updateUserNotificationTime(userId, time);

            // 2. ユーザーの状態を次の「電車の返信待ち」に更新
            await updateUserState(userId, 'AWAITING_TRAIN_LINE');

            // 3. お礼と次の質問を送信
            const replyText = `「${time}」やね、承知したで！`;
            const nextMessage = createAskTrainLineMessage();

            return client.replyMessage(event.replyToken, [
                { type: 'text', text: replyText },
                nextMessage
            ]);
        }

    } catch (error) {
        console.error('ボタンの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ごめんやで、今ちょっとボタンが効かへんみたい…。'
        });
    }
}

module.exports = handlePostback;
