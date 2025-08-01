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
const { createAskGarbageDayOfWeekMessage } = require('../templates/askGarbageDayOfWeekMessage');
const chrono = require('chrono-node');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- リマインダー機能の起動 ---
        const reminderKeywords = ['リマインド', 'リマインダー', '予定'];
        if (!user.state && reminderKeywords.some(keyword => messageText.toLowerCase().includes(keyword))) {
            await updateUserState(userId, 'AWAITING_REMINDER');
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！何をいつ教えたらええ？\n「明日の15時に会議」みたいに、ぜんぶまとめて言うてくれてええで。' });
        }

        // --- ステート（状態）に応じた会話の処理 ---
        if (user.state) {
            const state = user.state;
            if (state === 'AWAITING_REMINDER') {
                return await handleReminderInput(userId, messageText, client, event.replyToken, false);
            }
            if (state === 'AWAITING_GARBAGE_DAY_INPUT') {
                if (['終わり', 'おわり', 'もうない'].includes(messageText)) {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ゴミの日の設定、おおきに！' }, finalMessage]);
                }
                return await handleReminderInput(userId, messageText, client, event.replyToken, true);
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
            if (state === 'AWAITING_GARBAGE_DAY') {
                if (messageText === 'ゴミの日を設定する') {
                    await updateUserState(userId, 'AWAITING_GARBAGE_DAY_INPUT');
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！収集日を教えてや。\n「毎週火曜は燃えるゴミ」みたいに、一つずつ言うてな。終わったら「終わり」って言うてな。' });
                } else {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, finalMessage);
                }
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
    const results = chrono.ja.parse(text, new Date(), { timezone: 'Asia/Tokyo', forwardDate: true });

    if (results.length === 0) {
        if (isGarbageDayMode) {
            await client.replyMessage(replyToken, { type: 'text', text: 'すまんな、いつか分からんかったわ…\n「毎週火曜は燃えるゴミ」みたいに教えてくれるか？' });
            return true;
        }
        return false;
    }
    
    const sentences = text.split(/、|。/g).filter(s => s.trim());
    const remindersToConfirm = [];

    for (const sentence of sentences) {
        const sentenceResults = chrono.ja.parse(sentence, new Date(), { timezone: 'Asia/Tokyo', forwardDate: true });
        if (sentenceResults.length === 0) continue;

        const days = sentenceResults.map(r => r.start);
        let title = sentence;
        sentenceResults.forEach(r => {
            title = title.replace(r.text, '');
        });
        title = title.replace(/(で?に?、?を?)(リマインド|リマインダー|教えて|アラーム|って|のこと|は)$/, '').trim();
        title = title.replace(/^(に|で|は|を)/, '').trim();

        if (!title) continue;

        for (const date of days) {
            const reminderData = { title: title };
            const parsedDate = date.date();
            
            if (date.isCertain('weekday')) {
                reminderData.type = 'weekly';
                reminderData.dayOfWeek = date.get('weekday');
                if (!isGarbageDayMode) {
                    reminderData.notificationTime = date.isCertain('hour')
                        ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsedDate)
                        : '08:00';
                }
            } else {
                reminderData.type = 'once';
                reminderData.targetDate = parsedDate.toISOString();
            }
            remindersToConfirm.push(reminderData);
        }
    }

    if (remindersToConfirm.length === 0) {
        if (isGarbageDayMode) {
            await client.replyMessage(replyToken, { type: 'text', text: 'すまんな、いつか分からんかったわ…\n「毎週火曜は燃えるゴミ」みたいに教えてくれるか？' });
            return true;
        }
        return false;
    }
    
    const stateKey = isGarbageDayMode ? 'AWAITING_GARBAGE_CONFIRMATION' : 'AWAITING_REMINDER_CONFIRMATION';
    await updateUserState(userId, stateKey, { remindersData: remindersToConfirm });
    const confirmMessage = createConfirmReminderMessage(remindersToConfirm);
    await client.replyMessage(replyToken, confirmMessage);
    return true;
}

module.exports = handleMessage;
