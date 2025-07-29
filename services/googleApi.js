// services/googleApi.js - Google Maps APIと通信する専門家

const axios = require('axios');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * 出発地と目的地から路線リストを取得する
 * @param {string} from - 出発地
 * @param {string} to - 目的地
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesFromGoogle(from, to) {
    if (!API_KEY) {
        console.error('Google MapsのAPIキーが設定されてへんで！');
        return null;
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: from,
                destination: to,
                mode: 'transit', // 公共交通機関
                language: 'ja',
                key: API_KEY,
            }
        });

        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            console.warn(`Googleで経路が見つからんかったわ: ${from} -> ${to}`, response.data.status);
            return [];
        }

        // 検索結果の全ルートから、使われている路線名をすべて抜き出す
        const allLines = new Set();
        response.data.routes.forEach(route => {
            route.legs.forEach(leg => {
                leg.steps.forEach(step => {
                    if (step.transit_details) {
                        allLines.add(step.transit_details.line.short_name || step.transit_details.line.name);
                    }
                });
            });
        });

        return Array.from(allLines);

    } catch (error) {
        console.error(`Google APIでエラーが発生: ${from} -> ${to}`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = {
    getLinesFromGoogle,
};
