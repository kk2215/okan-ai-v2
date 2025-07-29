// handlers/handleFollow.js - 友だち追加イベントを担当

const { saveUser, updateUserState } = require('../services/user');
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
        // LINEサーバーからユーザーのプロフィール情報を取得
        const profile = await client.getProfile(userId);

        // 1. ユーザー情報をDBに保存
        await saveUser({
            userId: profile.userId,
            displayName: profile.displayName,
        });
        
        // 2. ユーザーの状態を「地域の返信待ち」に更新
        await updateUserState(userId, 'AWAITING_LOCATION');

        // 3. 挨拶と最初の質問を一緒に送信
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
