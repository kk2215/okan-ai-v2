// handlers/handlePostback.js - ボタン押下（ポストバックイベント）の処理を担当

const { getUser, updateUserState, updateUserNotificationTime, saveUserTrainLines } = require('../services/user');
const { createAskGarbageDayMessage } = require('../templates/askGarbageDayMessage');
const { createTrainLineConfirmationMessage } = require('../templates/trainLineConfirmationMessage'); // 新しい仲間

async function handlePostback(event, client) {
    const userId = event.source.userId;
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    try {
        const user = await getUser(userId);
        if (!user) return; // ユーザーがおらんかったら何もしない

        // 通知時間設定ボタンが押された場合
        if (action === 'set_notification_time') {
            const time = event.postback.params.time;
            await updateUserNotificationTime(userId, time);
            await updateUserState(userId, 'AWAITING_TRAIN_LINE');
            // 電車の質問をクイック返信に変えたので、ここではお礼だけ言う
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `「${time}」やね、承知したで！\n次は電車の設定や。下のボタンから選んでな。`,
                quickReply: {
                    items: [
                        { type: 'action', action: { type: 'message', label: '設定する', text: '電車の設定する' }},
                        { type: 'action', action: { type: 'message', label: 'いらん', text: 'なし' }}
                    ]
                }
            });
        }

        // 新しい仕事：経路選択ボタンが押された場合
        if (action === 'select_route') {
            const routeIndex = parseInt(data.get('index'), 10);
            const routes = user.tempData.routes; // 一時保存した経路リストを取得

            if (!routes || !routes[routeIndex]) {
                return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、どの経路を選んだか、わからんようになってしもたわ…' });
            }

            const selectedLines = routes[routeIndex].lines;
            
            // 確認メッセージを送る
            await updateUserState(userId, 'AWAITING_TRAIN_CONFIRMATION', { lines: selectedLines });
            const confirmationMessage = createTrainLineConfirmationMessage(selectedLines);
            return client.replyMessage(event.replyToken, confirmationMessage);
        }

        // 新しい仕事：路線登録の最終確認ボタンが押された場合
        if (action === 'confirm_train_lines') {
            const lines = user.tempData.lines;
            await saveUserTrainLines(userId, lines); // 路線をDBに本保存
            await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
            
            const replyText = 'よっしゃ、登録しといたで！';
            const nextMessage = createAskGarbageDayMessage();

            return client.replyMessage(event.replyToken, [{ type: 'text', text: replyText }, nextMessage]);
        }
        
        if (action === 'cancel_train_lines') {
             await updateUserState(userId, 'AWAITING_GARBAGE_DAY');
             const nextMessage = createAskGarbageDayMessage();
             return client.replyMessage(event.replyToken, [{ type: 'text', text: 'ほな、やめとこか。' }, nextMessage]);
        }


    } catch (error) {
        console.error('ボタンの処理でエラーが出てもうたわ:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめんやで、今ちょっとボタンが効かへんみたい…。' });
    }
}

module.exports = handlePostback;
