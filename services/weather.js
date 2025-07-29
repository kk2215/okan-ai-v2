// services/weather.js - 天気予報を取得する専門家

const axios = require('axios');

const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const BASE_URL = 'http://api.openweathermap.org/data/2.5/weather';

/**
 * 指定された場所の現在の天気を取得する
 * @param {string} location - 場所 (例: 'Tokyo,JP')
 * @returns {Promise<object|null>} 天気情報オブジェクト
 */
async function fetchWeather(location) {
    if (!API_KEY) {
        console.error('OpenWeatherMapのAPIキーが設定されてへんで！');
        return null;
    }

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                q: location,
                appid: API_KEY,
                units: 'metric', // 温度を摂氏に
                lang: 'ja'       // 説明を日本語に
            }
        });

        const data = response.data;
        return {
            description: data.weather[0].description, // 天気の詳細
            icon: data.weather[0].icon,             // 天気アイコン
            temp: Math.round(data.main.temp),       // 現在の気温
            temp_max: Math.round(data.main.temp_max), // 最高気温
            temp_min: Math.round(data.main.temp_min), // 最低気温
        };

    } catch (error) {
        console.error(`天気情報の取得に失敗したわ… 場所: ${location}`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = {
    fetchWeather
};
