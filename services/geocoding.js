// services/geocoding.js - Google Geocoding APIと通信する専門家

const axios = require('axios');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * 地名から場所の候補リストを取得する
 * @param {string} address - ユーザーが入力した地名
 * @returns {Promise<Array|null>} 場所の候補オブジェクトの配列
 */
async function searchLocations(address) {
    if (!API_KEY) {
        console.error('Google MapsのAPIキーが設定されてへんで！');
        return null;
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                language: 'ja',
                region: 'jp', // 日本国内に限定
                key: API_KEY,
            }
        });

        if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
            console.warn(`Geocoding APIで場所が見つからんかったわ: ${address}`, response.data.status);
            return [];
        }

        // 必要な情報だけを抜き出して返す
        return response.data.results.map(result => ({
            // 天気予報APIで使える形式（例: Suginami, Tokyo, JP）
            locationForWeather: `${result.address_components[0].long_name},JP`,
            // ユーザーに見せるための分かりやすい住所（例: 日本、〒166-8570 東京都杉並区阿佐谷南１丁目１５−１）
            formattedAddress: result.formatted_address,
        }));

    } catch (error) {
        console.error(`Geocoding APIでエラーが発生: ${address}`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = {
    searchLocations,
};
