// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesFromGoogle } = require('../services/googleApi'); // Googleの専門家を呼ぶ
const { saveReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createAskGarbageDayDetailsMessage } = require('../templates/askGarbageDayDetailsMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');

const dayOfWeekToNumber = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user || !user.state) {
            return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });
        }

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
            
            // ★★★ ここでGoogleの専門家を呼ぶんや！ ★★★
            const lines = await getLinesFromGoogle(from, to);

            if (!lines || lines.length === 0) {
                return client.replyMessage(event.replyToken, { type: 'text', text: `ごめん、「${from}」から「${to}」までの公共交通機関での行き方が見つからんかったわ…` });
            }
            
            await updateUserState(userId, 'AWAITING_LINE_SELECTION', { availableLines: lines, selectedLines: [] });
            const selectionMessage = createLineSelectionMessage(lines); // 見つかった路線リストを渡す
            return client.replyMessage(event.replyToken, selectionMessage);
        }
        
        if (state === 'AWAITING_GARBAGE_DAY') {
            if (messageText === 'ゴミの日を設定する') {
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_DETAILS');
                const nextMessage = createAskGarbageDayDetailsMessage();
                return client.replyMessage(event.replyToken, nextMessage);
            } else {
                await updateUserState(userId, null);
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, finalMessage);
            }
        }

        if (state === 'AWAITING_GARBAGE_DAY_DETAILS') {
            if (['なし', 'やめる', '設定しない', '終わり'].includes(messageText)) {
                await updateUserState(userId, null);
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ゴミの日の設定、おおきに！' }, finalMessage]);
            }
            const parts = messageText.split(/、|,| /).filter(p => p);
            if (parts.length >= 2) {
                const title = parts[0];
                const dayStr = parts[1].replace('曜日', '');
                const dayNum = dayOfWeekToNumber[dayStr];
                if (dayNum !== undefined) {
                    await saveReminder(userId, { title: title, type: 'weekly', dayOfWeek: dayNum });
                    return client.replyMessage(event.replyToken, { type: 'text', text: `「${title}は${dayStr}曜日」やね。覚えたで！\n\n他にもあったら続けて教えてな。なかったら「終わり」って言うてや。` });
                }
            }
            return client.replyMessage(event.replyToken, { type: 'text', text: `すまん、形式がようわからんかったわ…。「燃えるゴミ、火曜日」みたいにもう一回教えてくれるか？` });
        }

        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？なんか用事やったらメニューから選んでな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
