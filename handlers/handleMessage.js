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
const chrono = require('chrono-node');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return; // ユーザーがおらんかったら何もしない

        // --- リマインダー機能 ---
        // 「リマインド」「リマインダー」「教えて」「アラーム」などの言葉に反応
        const reminderKeywords = ['リマインド', 'リマインダー', '教えて', 'アラーム'];
        if (reminderKeywords.some(keyword => messageText.includes(keyword)) || user.state === 'AWAITING_REMINDER') {
            const results = chrono.ja.parse(messageText);

            if (results.length === 0) {
                await updateUserState(userId, 'AWAITING_REMINDER');
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！何をいつ教えたらええ？\n「毎週火曜の朝に燃えるゴミ」とか「明日の15時に会議」みたいに教えてな。' });
            }

            const result = results[0];
            const title = messageText.replace(result.text, '').trim().replace(/を?リマインド/, '').replace(/って?教えて/, '');
            
            if (!title) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、肝心の内容がわからんかったわ。もう一回、「〇〇をリマインド」みたいに教えてくれるか？' });
            }

            const reminderData = { title: title };
            const date = result.start;
            
            // 繰り返し（毎週・隔週）か、一回だけか判断
            if (result.start.isCertain('weekday')) { // 毎週〇曜日
                reminderData.type = 'weekly';
                reminderData.dayOfWeek = date.get('weekday');
                reminderData.notificationTime = date.isCertain('hour') ? `${String(date.get('hour')).padStart(2, '0')}:${String(date.get('minute')).padStart(2, '0')}` : '08:00';
            } else { // 一回だけ
                reminderData.type = 'once';
                reminderData.targetDate = date.date().toISOString();
            }

            await updateUserState(userId, 'AWAITING_REMINDER_CONFIRMATION', { reminderData });
            const confirmMessage = createConfirmReminderMessage(reminderData);
            return client.replyMessage(event.replyToken, confirmMessage);
        }

        // --- 初期設定フロー ---
        if (user.state) {
            const state = user.state;
            if (state === 'AWAITING_LOCATION') {
                const locationWithCountry = messageText + ',JP';
                await updateUserLocation(userId, locationWithCountry);
                const replyText = `「${messageText}」やね、覚えたで！`;
                await updateUserState(userId, 'AWAITING_NOTIFICATION_TIME');
                const nextMessage = createAskNotificationTimeMessage();
                return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
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
                    await updateUserState(userId, 'AWAITING_REMINDER'); // ゴミの日設定も新しいリマインダーフローに合流
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！収集日を教えてや。\n「毎週火曜に燃えるゴミ」みたいに、ぜんぶまとめて言うてくれてええで。' });
                } else {
                    await updateUserState(userId, null);
                    const finalMessage = createSetupCompleteMessage(user.displayName);
                    return client.replyMessage(event.replyToken, finalMessage);
                }
            }
        }

        // 通常の会話
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
