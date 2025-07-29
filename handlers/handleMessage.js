// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { searchLocations } = require('../services/geocoding'); // 地名のプロを呼ぶ
const { getLinesByStationName } = require('../services/heartrails');
const { saveReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createLocationSelectionMessage } = require('../templates/locationSelectionMessage'); // 新しい質問状
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');
const { createReminderMenuMessage } = require('../templates/reminderMenuMessage');
const chrono = require('chrono-node');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // リマインダー機能 (変更なし)
        const reminderKeywords = ['リマインド', 'リマインダー', '教えて', 'アラーム', '予定'];
        if (!user.state && reminderKeywords.some(keyword => messageText.includes(keyword))) {
            const reminderMenu = createReminderMenuMessage();
            return client.replyMessage(event.replyToken, reminderMenu);
        }
        if (user.state === 'AWAITING_REMINDER') { /* ... */ }

        // --- 初期設定フロー ---
        if (user.state) {
            const state = user.state;

            // 【状態1】地域の返信を待っている場合
            if (state === 'AWAITING_LOCATION') {
                const locations = await searchLocations(messageText);

                if (!locations || locations.length === 0) {
                    return client.replyMessage(event.replyToken, { type: 'text', text: `ごめん、「${messageText}」っていう場所、見つけられへんかったわ…。もう一回、市町村名から教えてくれるか？` });
                }

                if (locations.length === 1) {
                    const location = locations[0];
                    await updateUserLocation(userId, location.locationForWeather);
                    await updateUserState(userId, 'AWAITING_NOTIFICATION_TIME');
                    const replyText = `「${location.formattedAddress}」やね、覚えたで！`;
                    const nextMessage = createAskNotificationTimeMessage();
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
                }

                // 候補が複数ある場合
                await updateUserState(userId, 'AWAITING_LOCATION_SELECTION', { locations: locations });
                const selectionMessage = createLocationSelectionMessage(locations);
                return client.replyMessage(event.replyToken, selectionMessage);
            }

            // (以降のstateの処理は変更ないので省略)
        }

        // 通常の会話
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
