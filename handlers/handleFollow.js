// handlers/handleFollow.js - 友だち追加イベントを担当

const { saveUser } = require('../services/user');
const { createWelcomeMessage } = require('../templates/welcomeMessage');

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
        // まず、ユーザーの名簿を作るだけ。余計なことはせえへん。
        await saveUser({
            userId: profile.userId,
            displayName: profile.displayName,
        });
        
        // 挨拶と「設定を始める」ボタンを送る
        const welcomeMessage = createWelcomeMessage(profile.displayName);
        
        return client.replyMessage(event.replyToken, welcomeMessage);

    } catch (error) {
        console.error('あら大変！お友だち登録の処理でエラーよ:', error);
    }
}

module.exports = handleFollow;
