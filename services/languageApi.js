// services/languageApi.js - Google Cloud Natural Language APIと通信する専門家

const { LanguageServiceClient } = require('@google-cloud/language');
const { v1 } = require('@google-cloud/language'); // v1クライアントも使う
const languageClient = new v1.LanguageServiceClient();

/**
 * テキストを解析して、リマインダーの「内容」と「日時」を抜き出す
 * @param {string} text - ユーザーが入力したテキスト
 * @returns {Promise<Array|null>} 抜き出したリマインダー情報の配列
 */
async function extractReminders(text) {
    try {
        const document = {
            content: text,
            type: 'PLAIN_TEXT',
            language: 'ja',
        };

        // GoogleのAIに「この文章の中の、大事な言葉を全部教えて！」ってお願いする
        const [result] = await languageClient.analyzeEntities({ document });
        const entities = result.entities;

        // 「イベント（内容）」と「日付」を抜き出す
        const events = entities.filter(e => e.type === 'EVENT').map(e => e.name);
        const dates = entities.filter(e => e.type === 'DATE');

        if (events.length === 0 || dates.length === 0) {
            return null; // 内容か日付、どっちかわからんかったら諦める
        }

        const reminders = [];
        const title = events.join('、');

        for (const dateEntity of dates) {
            // "2025-07-30T14:00:00" のような日付文字列をDateオブジェクトに変換
            // Googleはんがくれる時間は、ちゃんと日本の時間になっとる
            const dateStr = dateEntity.metadata.iso_string;
            if (dateStr) {
                reminders.push({
                    title: title,
                    date: new Date(dateStr)
                });
            }
        }
        
        return reminders;

    } catch (error)
    {console.error('Google Natural Language APIでエラーが発生:', error);
        return null;
    }  


module.exports = {
    extractReminders,
};}
