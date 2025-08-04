// handlers/handleFollow.js - 友だち追加イベントを担当

const { saveUser } = require('../services/user'); // updateUserStateはもういらん
const { createWelcomeMessage } = require('../templates/welcomeMessage');
const { createAskLocationMessage } = require('../templates/askLocationMessage');

/**
 * ユーザーがボットを友だち追加したときの処理
 * @param {object} event - LINEのフォローイベントオブジェクト
 * @param {object} client - LINEのクライアントインスタンス
 */
async function handleFollow(event, client) {
    const userId = event.source.userId;
    console.log(`新しいお友だちが来たわよ！ User ID: ${userId}`);

    try {
        const profile = await client.getProfile(userId);

        // ★★★ これがほんまの最後の修正や！ ★★★
        // ユーザーの名簿を作ると同時に、「地理登録の返事待ち」ってメモも、一発で書き込む！
        await saveUser({
            userId: profile.userId,
            displayName: profile.displayName,
            state: 'AWAITING_LOCATION' // 最初の状態をここで指定する
        });
        
        // 挨拶と最初の質問を一緒に送信
        const welcomeMessage = createWelcomeMessage(profile.displayName);
        const askLocationMessage = createAskLocationMessage();
        
        return client.replyMessage(event.replyToken, [
            welcomeMessage,
            askLocationMessage
        ]);

    } catch (error) {
        console.error('あら大変！お友だち登録の処理でエラーよ:', error);
    }
}

module.exports = handleFollow;
