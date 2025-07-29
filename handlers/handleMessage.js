// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesByStationName } = require('../services/heartrails');
const { saveReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');
const { createReminderMenuMessage } = require('../templates/reminderMenuMessage'); // 新しいメニュー
const chrono = require('chrono-node');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- リマインダー機能 ---
        const reminderKeywords = ['リマインド', 'リマインダー', '教えて', 'アラーム', '予定'];
        // 初期設定中やなくて、リマインダーのキーワードが含まれる場合
        if (!user.state && reminderKeywords.some(keyword => messageText.includes(keyword))) {
            const reminderMenu = createReminderMenuMessage();
            return client.replyMessage(event.replyToken, reminderMenu);
        }

        // リマインダーの内容入力待ちの場合
        if (user.state === 'AWAITING_REMINDER') {
            const results = chrono.ja.parse(messageText);
            if (results.length === 0) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、いつか分からんかったわ…\n「明日の15時に会議」みたいに、日時も一緒に入れてくれるか？' });
            }
            const result = results[0];
            const title = messageText.replace(result.text, '').trim().replace(/を?リマインド/, '').replace(/って?教えて/, '');
            if (!title) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'すまん、肝心の内容がわからんかったわ。もう一回、「〇〇をリマインド」みたいに教えてくれるか？' });
            }
            const reminderData = { title: title };
            const date = result.start;
            if (result.start.isCertain('weekday')) {
                reminderData.type = 'weekly';
                reminderData.dayOfWeek = date.get('weekday');
                reminderData.notificationTime = date.isCertain('hour') ? `${String(date.get('hour')).padStart(2, '0')}:${String(date.get('minute')).padStart(2, '0')}` : '08:00';
            } else {
                reminderData.type = 'once';
                reminderData.targetDate = date.date().toISOString();
            }
            await updateUserState(userId, 'AWAITING_REMINDER_CONFIRMATION', { reminderData });
            const confirmMessage = createConfirmReminderMessage(reminderData);
            return client.replyMessage(event.replyToken, confirmMessage);
        }

        // --- 初期設定フロー ---
        if (user.state) {
            // (初期設定のコードは変更ないので省略)
        }

        // 通常の会話
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
