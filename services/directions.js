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
    if (!mapsClient) {
        return null;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const departureTime = Math.floor(tomorrow.getTime() / 1000);

    try {
        const response = await mapsClient.directions({
            params: {
                // ★★★ これがほんまの最終奥義や！駅の番地（プレイスID）で聞く！ ★★★
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
        console.error(`Directions APIでエラーが発生`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = {
    getLinesFromRoute,
};
