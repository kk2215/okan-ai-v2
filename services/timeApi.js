// services/timeApi.js - 世界の時間を正確に教えてくれる専門家

const axios = require('axios');

/**
 * 現在の正確な日本時刻をDateオブジェクトとして取得する
 * @returns {Promise<Date>}
 */
async function getCurrentJapaneseTime() {
    try {
        const response = await axios.get('http://worldtimeapi.org/api/timezone/Asia/Tokyo');
        // "2025-08-01T14:46:53.123+09:00" みたいな文字列を、正しいDateオブジェクトに変換して返す
        return new Date(response.data.datetime);
    } catch (error) {
        console.error('日本の時間の取得に失敗したわ…しゃあないからサーバーの時間で代用するで。', error);
        // もしAPIが落ちてても、とりあえず動くようにサーバーの時間を返す
        return new Date();
    }
}

module.exports = {
    getCurrentJapaneseTime,
};
