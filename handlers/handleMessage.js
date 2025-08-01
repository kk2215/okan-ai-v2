// handlers/handleMessage.js - テキストメッセージの処理を担当

const { getUser, updateUserState } = require('../services/user');
const { detectIntent } = require('../services/dialogflow'); // ★★★ 新しい頭脳を呼ぶ！ ★★★
const { createConfirmReminderMessage } = require('../templates/confirmReminderMessage');

async function handleMessage(event, client) {
    const userId = event.source.userId;
    const messageText = event.message.text.trim();

    try {
        const user = await getUser(userId);
        if (!user) return;

        // --- 会話は、まずDialogflowはんに丸投げ ---
        const intentResult = await detectIntent(userId, messageText);

        // ★★★ Dialogflowはんが「リマインダーの登録や！」と判断した場合 ★★★
        if (intentResult && intentResult.intent === 'SetReminder') {
            const params = intentResult.parameters;
            const dateTime = params.date_time || params.date;
            const title = params.any;

            if (dateTime && title) {
                const reminderData = {
                    title: title,
                    type: 'once', // 今は一回だけにしとく
                    targetDate: new Date(dateTime).toISOString(),
                };
                await updateUserState(userId, 'AWAITING_REMINDER_CONFIRMATION', { reminderData: reminderData });
                const confirmMessage = createConfirmReminderMessage([reminderData]);
                return client.replyMessage(event.replyToken, confirmMessage);
            }
        }

        // --- Dialogflowはんがわからんかった時の、いつもの返事 ---
        // (ここには、初期設定の会話とか、他の機能の会話が将来入ってくる)
        return client.replyMessage(event.replyToken, { type: 'text', text: 'どないしたん？' });

    } catch (error) {
        console.error('メッセージの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、ちょっと今忙しいみたい…。また後で話しかけてくれる？' });
    }
}

module.exports = handleMessage;
