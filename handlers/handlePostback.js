// handlers/handlePostback.js - ボタン押下（ポストバックイベント）の処理を担当

const { getUser, updateUserState, updateUserNotificationTime, saveUserTrainLines, updateUserLocation } = require('../services/user');
const { saveReminder, getReminders, deleteReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createTrainLineConfirmationMessage } = require('../templates/trainLineConfirmationMessage');
const { createListRemindersMessage } = require('../templates/listRemindersMessage');

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
            const reminders = await getReminders(userId);
            if (reminders.length === 0) {
                return client.replyMessage(event.replyToken, { type: 'text', text: '今は登録されとる予定、ないみたいやで。' });
            }
            const listMessage = createListRemindersMessage(reminders);
            return client.replyMessage(event.replyToken, listMessage);
        }
        if (action === 'delete_reminder') {
            const reminderId = data.get('id');
            await deleteReminder(userId, reminderId);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ほな、その予定は消しといたで！' });
        }

        // --- リマインダー確認ボタン ---
        if (action === 'confirm_reminder') {
            const reminderData = user.tempData.reminderData;
            if (!reminderData) { return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、なんの確認やったか忘れてもうたわ…' }); }
            await saveReminder(userId, reminderData);
            
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
        if (action === 'set_notification_time') {
            const time = event.postback.params.time;
            await updateUserNotificationTime(userId, time);
            await updateUserState(userId, 'AWAITING_TRAIN_LINE');
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `「${time}」やね、承知したで！\n次は電車の設定や。下のボタンから選んでな。`,
                quickReply: {
                    items: [
                        { type: 'action', action: { type: 'message', label: '設定する', text: '電車の設定する' }},
                        { type: 'action', action: { type: 'message', label: 'いらん', text: 'なし' }}
                    ]
                }
            });
        }
        if (action === 'add_line') {
            const lineToAdd = data.get('line');
            let selectedLines = user.tempData.selectedLines || [];
            if (!selectedLines.includes(lineToAdd)) { selectedLines.push(lineToAdd); }
            await updateUserState(userId, 'AWAITING_LINE_SELECTION', { ...user.tempData, selectedLines: selectedLines });
            return client.replyMessage(event.replyToken, { type: 'text', text: `「${lineToAdd}」を追加したで！` });
        }
        if (action === 'confirm_line_selection') {
            const selectedLines = user.tempData.selectedLines || [];
            if (selectedLines.length === 0) { return client.replyMessage(event.replyToken, { type: 'text', text: '路線が一つも選ばれてへんで！' }); }
            await updateUserState(userId, 'AWAITING_TRAIN_CONFIRMATION', { lines: selectedLines });
            const confirmationMessage = createTrainLineConfirmationMessage(selectedLines);
            return client.replyMessage(event.replyToken, confirmationMessage);
        }
        if (action === 'confirm_train_lines') {
            const lines = user.tempData.lines;
            await saveUserTrainLines(userId, lines);
            await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
            const replyText = 'よっしゃ、登録しといたで！';
            const nextMessage = createAskGarbageDayMessage();
            return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
        }
        if (action === 'cancel_train_lines') {
             await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
             const nextMessage = createAskGarbageDayMessage();
             return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ほな、やめとこか。' }, nextMessage]);
        }

    } catch (error) {
        console.error('ボタンの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、今ちょっとボタンが効かへんみたい…。' });
    }
}

module.exports = handlePostback;
