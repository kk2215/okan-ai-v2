// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createAskGarbageDayOfWeekMessage } = require('../templates/askGarbageDayOfWeekMessage');
const { createAskReminderDateTimeMessage } = require('../templates/askReminderDateTimeMessage');
const { createRegionSelectionMessage } = require('../templates/trainSelectionMessages');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- リマインダー機能の起動 ---
        const reminderKeywords = ['リマインダー', 'リマインド', '予定'];
        if (reminderKeywords.includes(messageText) && !user.state) {
            await updateUserState(userId, 'AWAITING_REMINDER_TITLE');
            return client.replyMessage(event.replyToken, { type: 'text', text: 'ええで！何を教えたらええ？' });
        }

        // --- ステート（状態）に応じた会話の処理 ---
        if (user.state) {
            const state = user.state;

            // --- 新しいリマインダー登録フロー ---
            if (state === 'AWAITING_REMINDER_TITLE') {
                await updateUserState(userId, 'AWAITING_REMINDER_DATETIME', { reminderTitle: messageText });
                const dateTimeMessage = createAskReminderDateTimeMessage();
                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: `「${messageText}」やね。ほな、それはいつや？` },
                    dateTimeMessage
                ]);
            }
            if (state === 'AWAITING_REMINDER_DATETIME') {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、下の「日時をえらぶ」ボタンで教えてくれるか？' });
            }

            // --- ゴミの日登録フロー ---
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
            
            // --- 路線登録フロー ---
            if (state === 'AWAITING_TRAIN_LINE') {
                if (messageText === '電車の設定する') {
                    await updateUserState(userId, 'AWAITING_REGION_SELECTION', { selectedLines: [] });
                    const regionMessage = createRegionSelectionMessage();
                    return client.replyMessage(event.replyToken, regionMessage);
                } else {
                    await saveUserTrainLines(userId, []);
                    await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
                    const nextMessage = createAskGarbageDayMessage();
                    return client.replyMessage(event.replyToken, [{ type: 'text', text: '電車はええのね。ほな次いこか！' }, nextMessage]);
                }
            }
        }

        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？予定を教えたい時は「リマインダー」って言うてみてな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
