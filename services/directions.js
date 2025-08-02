// services/directions.js - Google Directions APIと通信する専門家

const { Client } = require("@googlemaps/google-maps-services-js");

let mapsClient;

if (process.env.GOOGLE_MAPS_API_KEY) {
    mapsClient = new Client({});
    console.log('Googleのナビはん、厨房にお迎えしたで！');
} else {
    console.error('ナビはんを呼んでくるのに失敗したわ… GOOGLE_MAPS_API_KEYの設定、もう一回確認してくれるか？');
}

/**
 * 出発地と目的地のプレイスIDから、経由する全ての路線名を取得する
 * @param {string} originPlaceId - 出発地のプレイスID
 * @param {string} destinationPlaceId - 目的地のプレイスID
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesFromRoute(originPlaceId, destinationPlaceId) {
    if (!mapsClient) return null;

    // ★★★ これがほんまの最終奥義や！自力で日本の時間を計算する！ ★★★
    const nowInTokyoStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const nowInTokyo = new Date(nowInTokyoStr);
    const tomorrow = new Date(nowInTokyo);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const departureTime = Math.floor(tomorrow.getTime() / 1000);

    try {
        const response = await mapsClient.directions({
            params: {
                origin: `place_id:${originPlaceId}`,
                destination: `place_id:${destinationPlaceId}`,
                mode: 'transit',
                language: 'ja',
                region: 'jp',
                departure_time: departureTime,
                key: process.env.GOOGLE_MAPS_API_KEY
            },
            timeout: 3000,
        });

        if (response.data.status !== 'OK' || !response.data.routes || response.data.routes.length === 0) {
            console.warn(`Directions APIで経路が見つからんかったわ`, response.data.status);
            return [];
        }

        const allLines = new Set();
        response.data.routes.forEach(route => {
            route.legs.forEach(leg => {
                leg.steps.forEach(step => {
                    if (step.travel_mode === 'TRANSIT' && step.transit_details) {
                        allLines.add(step.transit_details.line.name);
                    }
                });
            });
        });

        return Array.from(allLines);

    } catch (error) {
        console.error(`Directions APIでエラーが発生`, error.message);
        return null;
    }
}

module.exports = {
    getLinesFromRoute,
};
