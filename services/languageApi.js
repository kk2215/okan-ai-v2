// services/languageApi.js - Google Cloud Natural Language APIと通信する専門家

const { LanguageServiceClient } = require('@google-cloud/language');
const languageClient = new LanguageServiceClient();

/**
 * テキストを解析して、リマインダーの「内容」と「日時」を抜き出す
 * @param {string} text - ユーザーが入力したテキスト
 * @returns {Promise<Array|null>} 抜き出したリマインダー情報の配列
 */
async function extractReminders(text) {
    try {
        const [result] = await languageClient.analyzeEntities({
            document: {
                content: text,
                type: 'PLAIN_TEXT',
                language: 'ja',
            },
            encodingType: 'UTF8',
        });

        const entities = result.entities;
        const events = entities.filter(e => e.type === 'EVENT').map(e => e.name);
        const dates = entities.filter(e => e.type === 'DATE');

        if (events.length === 0 || dates.length === 0) {
            return null; // 内容か日付、どっちかわからんかったら諦める
        }

        const reminders = [];
        // 「燃えるゴミは月曜と木曜」みたいに、内容1つに日付が複数ある場合を考える
        const title = events.join('、'); // 複数のイベントは「、」で繋ぐ
        for (const dateEntity of dates) {
            // "2025-07-30T13:00:00" のような日付文字列をDateオブジェクトに変換
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
