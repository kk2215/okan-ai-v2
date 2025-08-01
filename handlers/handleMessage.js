// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesByStationName } = require('../services/heartrails');
const { saveReminder } = require('../services/reminder');
const { searchLocations } = require('../services/geocoding');
const { extractReminders } = require('../services/languageApi'); // ★★★ 新しい頭脳を呼ぶ！ ★★★
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
            const state = user.state;
            if (state === 'AWAITING_REMINDER_TITLE') {
                await updateUserState(userId, 'AWAITING_REMINDER_DATETIME', { reminderTitle: messageText });
                return client.replyMessage(event.replyToken, { type: 'text', text: `「${messageText}」やね。ほな、それはいつや？` });
            }
            if (state === 'AWAITING_REMINDER_DATETIME') {
                const title = user.tempData.reminderTitle;
                return await handleReminderInput(userId, `${title} ${messageText}`, client, event.replyToken, false);
            }
            if (state === 'AWAITING_GARBAGE_DAY') {
                if (messageText === 'ゴミの日を設定する') {
                    await updateUserState(userId, 'AWAITING_GARBAGE_TYPE');
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！どのゴミの日を登録する？\n「燃えるゴミ」みたいに、まず名前を教えてな。' });
                } else {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, finalMessage);
                }
            }
            if (state === 'AWAITING_GARBAGE_TYPE') {
                if (['終わり', 'おわり', 'もうない'].includes(messageText)) {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ゴミの日の設定、おおきに！' }, finalMessage]);
                }
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_OF_WEEK', { garbageType: messageText, selectedDays: [] });
                const daySelectionMessage = createAskGarbageDayOfWeekMessage(messageText);
                return client.replyMessage(event.replyToken, daySelectionMessage);
            }
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
                await updateUserState(userId, 'AWAITING_LOCATION_SELECTION', { locations: locations });
                const selectionMessage = createLocationSelectionMessage(locations);
                return client.replyMessage(event.replyToken, selectionMessage);
            }
            if (state === 'AWAITING_TRAIN_LINE') {
                if (messageText === '電車の設定する') {
                    await updateUserState(userId, 'AWAITING_STATIONS');
                    const nextMessage = createAskStationsMessage();
                    return client.replyMessage(event.replyToken, nextMessage);
                } else {
                    await saveUserTrainLines(userId, []);
                    await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
                    const nextMessage = createAskGarbageDayMessage();
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: '電車はええのね。ほな次いこか！' }, nextMessage]);
                }
            }
            if (state === 'AWAITING_STATIONS') {
                const stations = messageText.split(/から|まで/g).map(s => s.trim()).filter(Boolean);
                if (stations.length < 2) {
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、駅がようわからんかったわ。「和光市から巣鴨」みたいにもう一回教えてくれるか？' });
                }
                const [from, to] = stations;
                const linesFrom = await getLinesByStationName(from);
                const linesTo = await getLinesByStationName(to);
                if ((!linesFrom || linesFrom.length === 0) && (!linesTo || linesTo.length === 0)) {
                    return client.replyMessage(event.replyToken, { type: 'text', text: `ごめん、「${from}」も「${to}」も見つからんかったわ…駅の名前、間違えてへんか？` });
                }
                const allLines = [...new Set([...(linesFrom || []), ...(linesTo || [])])];
                await updateUserState(userId, 'AWAITING_LINE_SELECTION', { availableLines: allLines, selectedLines: [] });
                const selectionMessage = createLineSelectionMessage(allLines);
                return client.replyMessage(event.replyToken, selectionMessage);
            }
        }

        // --- 通常の会話の中で、リマインダーがないかチェック ---
        const proactiveReminderResult = await handleReminderInput(userId, messageText, client, event.replyToken, false);
        if (proactiveReminderResult) {
            return;
        }

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
    const extracted = await extractReminders(text);

    if (!extracted || extracted.length === 0) {
        return false; // 通常会話では、わからんかったら静かにしとく
    }
    
    const remindersToConfirm = extracted.map(item => {
        const reminderData = { title: item.title };
        const date = item.date;
        
        if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            reminderData.type = 'weekly';
            reminderData.dayOfWeek = date.getDay();
        } else {
            reminderData.type = 'once';
            reminderData.targetDate = date.toISOString();
        }
        return reminderData;
    });

    if (remindersToConfirm.length === 0) { return false; }
    
    const stateKey = isGarbageDayMode ? 'AWAITING_GARBAGE_CONFIRMATION' : 'AWAITING_REMINDER_CONFIRMATION';
    await updateUserState(userId, stateKey, { remindersData: remindersToConfirm });
    const confirmMessage = createConfirmReminderMessage(remindersToConfirm);
    await client.replyMessage(replyToken, confirmMessage);
    return true;
}

module.exports = handleMessage;
