// services/dialogflow.js - Google Dialogflowと会話する専門家

const dialogflow = require('@google-cloud/dialogflow');
const { struct } = require('google-gax/build/src/fallback');

let sessionClient;
let projectId;

try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    projectId = serviceAccount.project_id;
    
    const credentials = {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
    };

    sessionClient = new dialogflow.SessionsClient({ projectId, credentials });
    console.log('Dialogflowはん、厨房にお迎えしたで！');

} catch (error) {
    console.error('Dialogflowはんを呼んでくるのに失敗したわ… FIREBASE_SERVICE_ACCOUNTの設定、もう一回確認してくれるか？', error);
}

/**
 * ユーザーの言葉をDialogflowに送って、意図と情報を抜き出す
 * @param {string} userId - ユーザーID
 * @param {string} text - ユーザーが入力したテキスト
 * @returns {Promise<object|null>}
 */
async function detectIntent(userId, text) {
    if (!sessionClient) {
        console.error('Dialogflow Clientが準備できてへんから、会話はでけへんわ。');
        return null;
    }

    const sessionPath = sessionClient.projectAgentSessionPath(projectId, userId);
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: text,
                languageCode: 'ja-JP',
            },
        },
        queryParams: {
            timeZone: 'Asia/Tokyo',
        },
    };

    try {
        const [response] = await sessionClient.detectIntent(request);
        const result = response.queryResult;

        if (result.intent && result.parameters && result.allRequiredParamsPresent) {
            return {
                intent: result.intent.displayName,
                parameters: struct.decode(result.parameters),
            };
        }
        return null;

    } catch (error) {
        console.error('Dialogflow APIでエラーが発生:', error);
        return null;
    }
}

module.exports = {
    detectIntent,
};
