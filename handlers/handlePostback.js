// handlers/handlePostback.js - ボタン押下（ポストバックイベント）の処理を担当

const { getUser, updateUserState, updateUserNotificationTime, saveUserTrainLines, updateUserLocation } = require('../services/user');
const { saveReminder, getReminders, deleteReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createTrainLineConfirmationMessage } = require('../templates/trainLineConfirmationMessage');
const { createListRemindersMessage } = require('../templates/listRemindersMessage');
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');
const { createAskReminderRepeatMessage } = require('../templates/askReminderRepeatMessage');
const { createAskLocationMessage } = require('../templates/askLocationMessage'); // 新しい設計図

async function handlePostback(event, client) {
    const userId = event.source.userId;
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    try {
        const user = await getUser(userId);
        if (!user) return;

        // ★★★ 新しい仕事：初期設定を始めるボタン ★★★
        if (action === 'start_setup') {
            await updateUserState(userId, 'AWAITING_LOCATION');
            const askLocationMessage = createAskLocationMessage();
            return client.replyMessage(event.replyToken, askLocationMessage);
        }

        // --- 新しいリマインダー登録フロー ---
        if (action === 'new_reminder') {
            await updateUserState(userId, 'AWAITING_REMINDER_TITLE');
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！何を教えたらええ？' });
        }
        if (action === 'set_reminder_datetime') {
            const datetime = event.postback.params.datetime;
            const title = user.tempData.reminderTitle;
            
            const reminderData = {
                title: title,
                type: 'once',
                targetDate: new Date(datetime + '+09:00').toISOString(),
            };

            await updateUserState(userId, 'AWAITING_REMINDER_REPEAT', { reminderData: reminderData });
            const repeatMessage = createAskReminderRepeatMessage();
            return client.replyMessage(event.replyToken, repeatMessage);
        }
        if (action === 'set_reminder_repeat') {
            const repeatType = data.get('type');
            let reminderData = user.tempData.reminderData;

            if (repeatType === 'weekly') {
                reminderData.type = 'weekly';
                const date = new Date(reminderData.targetDate);
                reminderData.dayOfWeek = date.getUTCDay();
                reminderData.notificationTime = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
            }
            
            await updateUserState(userId, 'AWAITING_REMINDER_CONFIRMATION', { remindersData: [reminderData] });
            const confirmMessage = createConfirmReminderMessage([reminderData]);
            return client.replyMessage(event.replyToken, confirmMessage);
        }

        // --- ゴミの日登録（曜日選択） ---
        if (action === 'set_garbage_day') {
            const dayOfWeek = parseInt(data.get('day'), 10);
            const dayMap = ['日曜','月曜','火曜','水曜','木曜','金曜','土曜'];
            
            let selectedDays = user.tempData.selectedDays || [];
            let replyText;

            if (selectedDays.includes(dayOfWeek)) {
                selectedDays = selectedDays.filter(d => d !== dayOfWeek);
                replyText = `「${dayMap[dayOfWeek]}」を取り消したで！`;
            } else {
                selectedDays.push(dayOfWeek);
                replyText = `「${dayMap[dayOfWeek]}」を追加したで！`;
            }
            
            await updateUserState(userId, 'AWAITING_GARBAGE_DAY_OF_WEEK', { ...user.tempData, selectedDays: selectedDays });
            return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
        }

        // --- ゴミの日登録（曜日決定） ---
        if (action === 'confirm_garbage_days') {
            const garbageType = user.tempData.garbageType;
            const selectedDays = user.tempData.selectedDays;

            if (!garbageType || !selectedDays || selectedDays.length === 0) {
                return client.replyMessage(event.replyToken, { type: 'text', text: '曜日が一つも選ばれてへんで！' });
            }

            for (const day of selectedDays) {
                await saveReminder(userId, {
                    title: garbageType,
                    type: 'weekly',
                    dayOfWeek: day,
                });
            }
            
            const dayMap = ['日曜','月曜','火曜','水曜','木曜','金曜','土曜'];
            const registeredDays = selectedDays.map(d => dayMap[d]).join('と');

            await updateUserState(userId, 'AWAITING_GARBAGE_TYPE');
            return client.replyMessage(event.replyToken, { type: 'text', text: `よっしゃ、「${garbageType}」は${registeredDays}やな！\n\n他にはあるか？なかったら「終わり」って言うてな。` });
        }

        // --- リマインダーメニューのボタン処理 ---
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
            const remindersData = user.tempData.remindersData;
            if (!remindersData || remindersData.length === 0) { return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、なんの確認やったか忘れてもうたわ…' }); }
            
            for (const reminderData of remindersData) {
                await saveReminder(userId, reminderData);
            }
            
            await updateUserState(userId, null);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'よっしゃ、覚えといたで！時間になったら教えるな！' });
        }
        if (action === 'cancel_reminder') {
            await updateUserState(userId, null);
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ほな、やめとこか。' });
        }

        // --- 初期設定フローのボタン ---
        if (action === 'select_location') {
            const locationIndex = parseInt(data.get('index'), 10);
            const locations = user.tempData.locations;
            if (!locations || !locations[locationIndex]) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、どの場所を選んだか、わからんようになってしもたわ…' });
            }
            const selectedLocation = locations[locationIndex];
            await updateUserLocation(userId, { 
                location: selectedLocation.locationForWeather, 
                lat: selectedLocation.lat, 
                lng: selectedLocation.lng 
            });
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
            let replyText;
            
            if (selectedLines.includes(lineToAdd)) {
                selectedLines = selectedLines.filter(l => l !== lineToAdd);
                replyText = `「${lineToAdd}」を取り消したで！`;
            } else {
                selectedLines.push(lineToAdd);
                replyText = `「${lineToAdd}」を追加したで！`;
            }
            
            await updateUserState(userId, 'AWAITING_LINE_SELECTION', { ...user.tempData, selectedLines: selectedLines });
            return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
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
