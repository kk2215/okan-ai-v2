// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesByStationName } = require('../services/heartrails');
const { saveReminder } = require('../services/reminder');
const { searchLocations } = require('../services/geocoding');
const { detectIntent } = require('../services/dialogflow'); // ★★★ 新しい頭脳を呼ぶ！ ★★★
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');
const { createLocationSelectionMessage } = require('../templates/locationSelectionMessage');
const { createReminderMenuMessage } = require('../templates/reminderMenuMessage');
const { createAskGarbageDayOfWeekMessage } = require('../templates/askGarbageDayOfWeekMessage');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- ステート（状態）に応じた会話の処理 ---
        if (user.state) {
            // (初期設定のコードは変更ないので省略)
        }

        // --- 通常の会話は、まずDialogflowはんに相談 ---
        const intentResult = await detectIntent(userId, messageText);

        if (intentResult && intentResult.intent === 'SetReminder') {
            const params = intentResult.parameters;
            const date = params.date_time || params.date;
            const title = params.any;

            if (date && title) {
                const reminderData = {
                    title: title,
                    type: 'once', // 今は一回だけにしとく
                    targetDate: new Date(date).toISOString(),
                };
                await updateUserState(userId, 'AWAITING_REMINDER_CONFIRMATION', { reminderData: reminderData });
                const confirmMessage = createConfirmReminderMessage([reminderData]);
                return client.replyMessage(event.replyToken, confirmMessage);
            }
        }

        // --- Dialogflowはんがわからんかった時の、いつもの返事 ---
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
