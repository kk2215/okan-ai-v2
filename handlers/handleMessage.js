// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserLocation, updateUserState, saveUserTrainLines } = require('../services/user');
const { saveReminder } = require('../services/reminder'); // 新しい仲間をインポート
const { createAskNotificationTimeMessage } = require('../templates/askNotificationTimeMessage');
const { createAskForTrainLineNameMessage } = require('../templates/askForTrainLineNameMessage');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createAskGarbageDayDetailsMessage } = require('../templates/askGarbageDayDetailsMessage'); // 新しい仲間
const { createSetupCompleteMessage } = require('../templates/setupCompleteMessage'); // 新しい仲間

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

        // ... (AWAITING_LOCATION, AWAITING_TRAIN_LINE, AWAITING_TRAIN_LINE_NAME の処理は省略)
        if (state === 'AWAITING_LOCATION') { /* ... */ }
        if (state === 'AWAITING_TRAIN_LINE') { /* ... */ }
        if (state === 'AWAITING_TRAIN_LINE_NAME') { /* ... */ }


        // 【状態4】ゴミの日設定の要否を待っている場合
        if (state === 'AWAITING_GARBAGE_DAY') {
            if (messageText === 'ゴミの日を設定する') {
                await updateUserState(userId, 'AWAITING_GARBAGE_DAY_DETAILS');
                const nextMessage = createAskGarbageDayDetailsMessage();
                return client.replyMessage(event.replyToken, nextMessage);
            } else { // 「ゴミの日は設定しない」や他の言葉の場合
                await updateUserState(userId, null); // これで設定完了
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, finalMessage);
            }
        }

        // 【状態5】ゴミの日の詳細を待っている場合
        if (state === 'AWAITING_GARBAGE_DAY_DETAILS') {
            if (['なし', 'やめる', '設定しない'].includes(messageText)) {
                await updateUserState(userId, null); // これで設定完了
                const finalMessage = createSetupCompleteMessage(user.displayName);
                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: '気ぃ変わったんか。ほな、ゴミの日は設定せんどくわ。' },
                    finalMessage
                ]);
            }
            
            // "燃えるゴミ、火曜日" のような形式を解析
            const parts = messageText.split(/、|,| /).filter(p => p); // 区切り文字で分割
            if (parts.length >= 2) {
                const title = parts[0];
                const dayStr = parts[1].replace('曜日', '');
                const dayNum = dayOfWeekToNumber[dayStr];

                if (dayNum !== undefined) {
                    await saveReminder(userId, {
                        title: title,
                        type: 'weekly', // 今は毎週のみ対応
                        dayOfWeek: dayNum
                    });
                     await client.replyMessage(event.replyToken, { type: 'text', text: `「${title}は${dayStr}曜日」やね。覚えたで！` });
                } else {
                     await client.replyMessage(event.replyToken, { type: 'text', text: `すまん、曜日がようわからんかったわ…。「燃えるゴミ、火曜日」みたいにもう一回教えてくれるか？` });
                     return; // 状態は変えずに再入力を待つ
                }
            } else {
                await client.replyMessage(event.replyToken, { type: 'text', text: `すまん、形式がようわからんかったわ…。「燃えるゴミ、火曜日」みたいにもう一回教えてくれるか？` });
                return; // 状態は変えずに再入力を待つ
            }

            // 複数のゴミの日を設定できるように、まだ状態は変えない
            // ユーザーが「終わり」などと入力したら完了にするのが親切だが、今回は一旦これで完了とする
            await updateUserState(userId, null);
            const finalMessage = createSetupCompleteMessage(user.displayName);
            return client.pushMessage(userId, finalMessage); // pushで完了メッセージを送る
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
