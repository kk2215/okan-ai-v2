// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState, updateUserLocation, saveUserTrainLines } = require('../services/user');
const { getLinesFromRoute } = require('../services/directions'); // 新しいナビはんを呼ぶ！
const { searchLocations } = require('../services/geocoding');
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskStationsMessage } = require('../templates/askStationsMessage');
const { createLineSelectionMessage } = require('../templates/lineSelectionMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage');
const { createLocationSelectionMessage } = require('../templates/locationSelectionMessage');
const { createAskGarbageDayOfWeekMessage } = require('../templates/askGarbageDayOfWeekMessage');
const { createAskReminderDateTimeMessage } = require('../templates/askReminderDateTimeMessage');

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
            
            // --- その他の初期設定フロー ---
            if (state === 'AWAITING_LOCATION') {
                const locations = await searchLocations(messageText);
                if (!locations || locations.length === 0) {
                    return client.replyMessage(event.replyToken, { type: 'text', text: `ごめん、「${messageText}」っていう場所、見つけられへんかったわ…。もう一回、市町村名から教えてくれるか？` });
                }
                if (locations.length === 1) {
                    const location = locations[0];
                    await updateUserLocation(userId, { location: location.locationForWeather, lat: location.lat, lng: location.lng });
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
                    return client.replyMessage(event.replyToken, { type: 'text', text: 'すまんな、駅がようわからんかったわ。「板橋から六本木」みたいにもう一回教えてくれるか？' });
                }
                const [from, to] = stations;
                const allLines = await getLinesFromRoute(from, to);
                if (!allLines || allLines.length === 0) {
                    return client.replyMessage(event.replyToken, { type: 'text', text: `ごめん、「${from}」から「${to}」までの行き方が見つからんかったわ…駅の名前、間違えてへんか？` });
                }
                await updateUserState(userId, 'AWAITING_LINE_SELECTION', { availableLines: allLines, selectedLines: [] });
                const selectionMessage = createLineSelectionMessage(allLines);
                return client.replyMessage(event.replyToken, selectionMessage);
            }
        }

        // --- どの機能にも当てはまらんかった時の、賢い返事 ---
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？予定を教えたい時は「リマインダー」って言うてみてな👵' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
