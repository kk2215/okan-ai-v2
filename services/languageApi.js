// services/languageApi.js - Google Cloud Natural Language APIと通信する専門家

const { LanguageServiceClient } = require('@google-cloud/language');

let languageClient;

try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    languageClient = new LanguageServiceClient({
        credentials: {
            client_email: serviceAccount.client_email,
            private_key: serviceAccount.private_key,
        },
        projectId: serviceAccount.project_id,
    });
    console.log('GoogleのAIはん、厨房にお迎えしたで！');
} catch (error) {
    console.error('GoogleのAIはんを呼んでくるのに失敗したわ… FIREBASE_SERVICE_ACCOUNTの設定、もう一回確認してくれるか？', error);
}

/**
 * テキストを解析して、リマインダーの「内容」と「日時」を抜き出す
 * @param {string} text - ユーザーが入力したテキスト
 * @returns {Promise<Array|null>} 抜き出したリマインダー情報の配列
 */
async function extractReminders(text) {
    if (!languageClient) {
        console.error('Language Clientが準備できてへんから、リマインダーの解析はでけへんわ。');
        return null;
    }

    try {
        const document = {
            content: text,
            type: 'PLAIN_TEXT',
            language: 'ja',
        };

        const [result] = await languageClient.analyzeEntities({ document });
        const entities = result.entities;

        const events = entities.filter(e => e.type === 'EVENT').map(e => e.name);
        const dates = entities.filter(e => e.type === 'DATE');

        if (events.length === 0 || dates.length === 0) {
            return null;
        }

        const reminders = [];
        const title = events.join('、');

        for (const dateEntity of dates) {
            const dateStr = dateEntity.metadata.iso_string;
            if (dateStr) {
                reminders.push({
                    title: title,
                    date: new Date(dateStr)
                });
            }
        }
        
        return reminders;

    } catch (error) {
        console.error('Google Natural Language APIでエラーが発生:', error);
        return null;
    }
}

module.exports = {
    extractReminders,
};
