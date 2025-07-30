// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesByStationName } = require('../services/heartrails');
const { saveReminder } = require('../services/reminder');
const { searchLocations } = require('../services/geocoding');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');
const { createLocationSelectionMessage } = require('../templates/locationSelectionMessage');
const { createReminderMenuMessage } = require('../templates/reminderMenuMessage');
const chrono = require('chrono-node');
const { utcToZonedTime } = require('date-fns-tz');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- リマインダー機能 ---
        const reminderKeywords = ['リマインド', 'リマインダー', '教えて', 'アラーム', '予定'];
        if (!user.state && reminderKeywords.some(keyword => messageText.includes(keyword))) {
            const reminderMenu = createReminderMenuMessage();
            return client.replyMessage(event.replyToken, reminderMenu);
        }
        if (user.state === 'AWAITING_REMINDER') {
            return await handleReminderInput(userId, messageText, client, event.replyToken, false);
        }

        // --- 初期設定フロー ---
        if (user.state) {
            const state = user.state;
            if (state === 'AWAITING_LOCATION') { /* (省略) */ }
            if (state === 'AWAITING_TRAIN_LINE') { /* (省略) */ }
            if (state === 'AWAITING_STATIONS') { /* (省略) */ }
            if (state === 'AWAITING_GARBAGE_DAY') {
                if (messageText === 'ゴミの日を設定する') {
                    await updateUserState(userId, 'AWAITING_GARBAGE_DAY_INPUT');
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！収集日を教えてや。\n「毎週火曜に燃えるゴミ」みたいに、一つずつ言うてな。終わったら「終わり」って言うてや。' });
                } else {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, finalMessage);
                }
            }
            // 新しい状態：ゴミの日を連続で待つ
            if (state === 'AWAITING_GARBAGE_DAY_INPUT') {
                if (['終わり', 'おわり', 'もうない'].includes(messageText)) {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ゴミの日の設定、おおきに！' }, finalMessage]);
                }
                return await handleReminderInput(userId, messageText, client, event.replyToken, true);
            }
        }

        // --- 通常の会話の中で、リマインダーがないかチェック ---
        const proactiveReminderResult = await handleReminderInput(userId, messageText, client, event.replyToken, false);
        if (proactiveReminderResult) {
            return;
        }

        // --- どの機能にも当てはまらんかった時の、いつもの返事 ---
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

/**
 * ユーザーの言葉から「いつ」「何を」を読み取って、リマインダーとして処理する関数
 */
async function handleReminderInput(userId, text, client, replyToken, isGarbageDayMode) {
    const referenceDate = utcToZonedTime(new Date(), 'Asia/Tokyo');
    const results = chrono.ja.parse(text, referenceDate, { forwardDate: true });

    if (results.length === 0) {
        if (isGarbageDayMode) {
            await client.replyMessage(replyToken, { type: 'text', text: 'すまんな、いつか分からんかったわ…\n「毎週火曜に燃えるゴミ」みたいに教えてくれるか？' });
            return true;
        }
        return false;
    }
    
    const result = results[0];
    
    let title = text.replace(result.text, '').trim();
    title = title.replace(/(で?に?、?を?)(リマインド|リマインダー|教えて|アラーム|って|のこと)$/, '').trim();
    title = title.replace(/^(に|で|は|を)/, '').trim();

    if (!title) {
        if (isGarbageDayMode) {
            await client.replyMessage(replyToken, { type: 'text', text: 'すまん、肝心の内容がわからんかったわ。もう一回、「〇〇をリマインド」みたいに教えてくれるか？' });
            return true;
        }
        return false;
    }

    const reminderData = { title: title };
    const date = result.start;

    if (date.isCertain('hour') && !date.isCertain('meridiem')) {
        const hour = date.get('hour');
        const currentHour = referenceDate.getHours();
        if (hour < 12 && hour >= 5 && hour < currentHour) {
            date.assign('hour', hour + 12);
            date.assign('meridiem', 1);
        }
    }
    
    if (result.start.isCertain('weekday')) {
        reminderData.type = 'weekly';
        reminderData.dayOfWeek = date.get('weekday');
        reminderData.notificationTime = date.isCertain('hour') ? `${String(date.get('hour')).padStart(2, '0')}:${String(date.get('minute')).padStart(2, '0')}` : '08:00';
    } else {
        reminderData.type = 'once';
        reminderData.targetDate = date.date().toISOString();
    }
    
    // isGarbageDayModeで確認メッセージを変える
    const stateKey = isGarbageDayMode ? 'AWAITING_GARBAGE_CONFIRMATION' : 'AWAITING_REMINDER_CONFIRMATION';
    await updateUserState(userId, stateKey, { reminderData });
    const confirmMessage = createConfirmReminderMessage(reminderData);
    await client.replyMessage(replyToken, confirmMessage);
    return true;
}

module.exports = handleMessage;
