// handlers/handlePostback.js - ボタン押下（ポストバックイベント）の処理を担当

const { getUser, updateUserState, updateUserNotificationTime, saveUserTrainLines, updateUserLocation } = require('../services/user');
const { saveReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createTrainLineConfirmationMessage } = require('../templates/trainLineConfirmationMessage');

async function handlePostback(event, client) {
    const userId = event.source.userId;
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- 新しい仕事：地域選択ボタン ---
        if (action === 'select_location') {
            const locationIndex = parseInt(data.get('index'), 10);
            const locations = user.tempData.locations;
            if (!locations || !locations[locationIndex]) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、どの場所を選んだか、わからんようになってしもたわ…' });
            }
            const selectedLocation = locations[locationIndex];
            await updateUserLocation(userId, selectedLocation.locationForWeather);
            await updateUserState(userId, 'AWAITING_NOTIFICATION_TIME');
            const replyText = `「${selectedLocation.formattedAddress}」やね、承知したで！`;
            const nextMessage = createAskNotificationTimeMessage();
            return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
        }

        // (以降のボタン処理は変更ないので省略)

    } catch (error) {
        console.error('ボタンの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、今ちょっとボタンが効かへんみたい…。' });
    }
}

module.exports = handlePostback;
