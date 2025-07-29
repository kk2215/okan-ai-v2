// services/googleApi.js - Google Maps APIと通信する専門家

const axios = require('axios');
// もう時差ボケを直す道具には頼らへん！自力で計算するで！

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * 出発地と目的地から路線リストを取得する（最終奥義・自力計算版）
 * @param {string} from - 出発地
 * @param {string} to - 目的地
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesFromGoogle(from, to) {
    if (!API_KEY) {
        console.error('Google MapsのAPIキーが設定されてへんで！');
        return null;
    }

    const fromStation = from.endsWith('駅') ? from : from + '駅';
    const toStation = to.endsWith('駅') ? to : to + '駅';

    // ★★★ これが最後の作戦や！外部の道具に頼らず、日本の時間を計算する！ ★★★
    // サーバーがどこにおっても、日本の現在時刻を文字列として取得する
    const nowInTokyoStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    // その文字列から、日本の現在時刻のDateオブジェクトを作る
    const nowInTokyo = new Date(nowInTokyoStr);

    // その日本の日付を基準に、明日の日付にする
    nowInTokyo.setDate(nowInTokyo.getDate() + 1);
    // 時間を朝の8時に設定
    nowInTokyo.setHours(8, 0, 0, 0);

    // Googleはんがわかる秒単位の数字にする
    const departureTime = Math.floor(nowInTokyo.getTime() / 1000);


    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: fromStation,
                destination: toStation,
                mode: 'transit',
                language: 'ja',
                region: 'jp',
                departure_time: departureTime,
                key: API_KEY,
            }
        });

        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            console.warn(`Googleで経路が見つからんかったわ: ${fromStation} -> ${toStation}`, response.data.status);
            return await searchWithoutStationSuffix(from, to, departureTime);
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
async function searchWithoutStationSuffix(from, to, departureTime) {
    console.log('「駅」を付けへんでもう一回探してみるで…');
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: { 
                origin: from, 
                destination: to, 
                mode: 'transit', 
                language: 'ja', 
                region: 'jp',
                departure_time: departureTime,
                key: API_KEY 
            }
        });
        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            return [];
        }
        return extractLinesFromRoutes(response.data.routes);
    } catch (error) {
        return null;
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
