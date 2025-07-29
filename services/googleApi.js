// services/googleApi.js - Google Maps APIと通信する専門家

const axios = require('axios');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * 出発地と目的地から路線リストを取得する（賢い版）
 * @param {string} from - 出発地
 * @param {string} to - 目的地
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesFromGoogle(from, to) {
    if (!API_KEY) {
        console.error('Google MapsのAPIキーが設定されてへんで！');
        return null;
    }

    // まずは「〇〇駅」で検索を試みる
    const fromStation = from.endsWith('駅') ? from : from + '駅';
    const toStation = to.endsWith('駅') ? to : to + '駅';

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: fromStation,
                destination: toStation,
                mode: 'transit',
                language: 'ja',
                key: API_KEY,
            }
        });

        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            console.warn(`Googleで経路が見つからんかったわ: ${fromStation} -> ${toStation}`, response.data.status);
            // 「駅」を付けずに、元の名前でもう一回だけ試してみる
            return await searchWithoutStationSuffix(from, to);
        }

        return extractLinesFromRoutes(response.data.routes);

    } catch (error) {
        console.error(`Google APIでエラーが発生: ${fromStation} -> ${toStation}`, error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * 「駅」を付けずに再検索するヘルパー関数
 */
async function searchWithoutStationSuffix(from, to) {
    console.log('「駅」を付けへんでもう一回探してみるで…');
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: { origin: from, destination: to, mode: 'transit', language: 'ja', key: API_KEY }
        });
        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            return []; // 再検索でもダメなら、空っぽを返す
        }
        return extractLinesFromRoutes(response.data.routes);
    } catch (error) {
        return null; // 再検索でエラーなら、もう諦める
    }
}

/**
 * Googleの経路データから路線名を抜き出すヘルパー関数
 */
function extractLinesFromRoutes(routes) {
    const allLines = new Set();
    routes.forEach(route => {
        route.legs.forEach(leg => {
            leg.steps.forEach(step => {
                if (step.transit_details) {
                    // "JR山手線" のような名前を優先して使う
                    allLines.add(step.transit_details.line.name || step.transit_details.line.short_name);
                }
            });
        });
    });
    return Array.from(allLines);
}


module.exports = {
    getLinesFromGoogle,
};
