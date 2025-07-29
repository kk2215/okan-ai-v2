// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserLocation, updateUserState, saveUserTrainLines } = require('../services/user');
const { saveReminder } = require('../services/reminder');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskForTrainLineNameMessage } = require('../templates/askForTrainLineNameMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createAskGarbageDayDetailsMessage } = require('../templates/askGarbageDayDetailsMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');

// 曜日を数字に変換するヘルパー
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

        // 【状態1】地域の返信を待っている場合
        if (state === 'AWAITING_LOCATION') {
            const locationWithCountry = messageText + ',JP';
            await updateUserLocation(userId, locationWithCountry);
            const replyText = `「${messageText}」やね、覚えたで！`;
            await updateUserState(userId, 'AWAITING_NOTIFICATION_TIME');
            const nextMessage = createAskNotificationTimeMessage();
            return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
        }
        
        // 【状態2】電車の要否を待っている場合
        if (state === 'AWAITING_TRAIN_LINE') {
            if (messageText === '電車の設定する') {
                await updateUserState(userId, 'AWAITING_TRAIN_LINE_NAME');
                const nextMessage = createAskForTrainLineNameMessage();
                return client.replyMessage(event.replyToken, nextMessage);
            } else { // 「なし」や他の言葉の場合
                await saveUserTrainLines(userId, []);
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
                const nextMessage = createAskGarbageDayMessage();
                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: '電車はええのね。ほな次いこか！' },
                    nextMessage
                ]);
            }
        }

        // 【状態3】路線名の返信を待っている場合
        if (state === 'AWAITING_TRAIN_LINE_NAME') {
            let lines = [];
            let replyText = '';
            if (['なし', 'いらない', 'やっぱやめる'].includes(messageText)) {
                replyText = '気ぃ変わったんか。ほな、電車は設定せんどくわ。';
            } else {
                lines = messageText.split(/、|,/g).map(line => line.trim());
                replyText = `「${lines.join('」と「')}」やね。しっかり覚えとくわ！`;
            }
            await saveUserTrainLines(userId, lines);
            await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
            const nextMessage = createAskGarbageDayMessage();
            return client.replyMessage(event.replyToken, [
                { type: 'text', text: replyText },
                nextMessage
            ]);
        }

        // 【状態4】ゴミの日設定の要否を待っている場合
        if (state === 'AWAITING_GARBAGE_DAY') {
            if (messageText === 'ゴミの日を設定する') {
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_DETAILS');
                const nextMessage = createAskGarbageDayDetailsMessage();
                return client.replyMessage(event.replyToken, nextMessage);
            } else { // 「ゴミの日は設定しない」や他の言葉の場合
                await updateUserState(userId, null);
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, finalMessage);
            }
        }

        // 【状態5】ゴミの日の詳細を待っている場合
        if (state === 'AWAITING_GARBAGE_DAY_DETAILS') {
            if (['なし', 'やめる', '設定しない', '終わり'].includes(messageText)) {
                await updateUserState(userId, null);
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: 'ゴミの日の設定、おおきに！' },
                    finalMessage
                ]);
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

        // 通常の会話
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'どないしたん？なんか用事やったらメニューから選んでな👵'
        });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
