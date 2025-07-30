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

        // --- リマインダーメニューのボタン処理 ---
        if (action === 'new_reminder') {
            await updateUserState(userId, 'AWAITING_REMINDER');
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！何をいつ教えたらええ？\n「明日の15時に会議」みたいに教えてな。' });
        }
        if (action === 'list_reminders') {
            return client.replyMessage(event.replyToken, { type: 'text', text: '登録した予定を見る機能は、今準備中やねん。もうちょい待っといてな！' });
        }

        // --- リマインダー確認ボタン ---
        if (action === 'confirm_reminder') {
            const reminderData = user.tempData.reminderData;
            if (!reminderData) { return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、なんの確認やったか忘れてもうたわ…' }); }
            await saveReminder(userId, reminderData);

            // ゴミの日設定中やったら、続きを聞く
            if (user.state === 'AWAITING_GARBAGE_CONFIRMATION') {
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_INPUT');
                return client.replyMessage(event.replyToken, { type: 'text', text: 'よっしゃ、覚えといたで！他にはあるか？なかったら「終わり」って言うてな。' });
            } else {
                await updateUserState(userId, null);
                return client.replyMessage(event.replyToken, { type: 'text', text: 'よっしゃ、覚えといたで！時間になったら教えるな！' });
            }
        }
        if (action === 'cancel_reminder') {
            if (user.state === 'AWAITING_GARBAGE_CONFIRMATION') {
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_INPUT');
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ほな、やめとこか。他にはあるか？' });
            } else {
                await updateUserState(userId, null);
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ほな、やめとこか。' });
            }
        }

        // --- 初期設定フローのボタン ---
        if (action === 'select_location') { /* (省略) */ }
        if (action === 'set_notification_time') { /* (省略) */ }
        if (action === 'add_line') { /* (省略) */ }
        if (action === 'confirm_line_selection') { /* (省略) */ }
        if (action === 'confirm_train_lines') { /* (省略) */ }
        if (action === 'cancel_train_lines') { /* (省略) */ }

    } catch (error) {
        console.error('ボタンの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、今ちょっとボタンが効かへんみたい…。' });
    }
}

module.exports = handlePostback;
