// services/geocoding.js - Google Geocoding & Places APIと通信する専門家

const { Client } = require("@googlemaps/google-maps-services-js");

let mapsClient;

if (process.env.GOOGLE_MAPS_API_KEY) {
    mapsClient = new Client({});
    console.log('Googleの地図のプロはん、厨房にお迎えしたで！');
} else {
    console.error('地図のプロはんを呼んでくるのに失敗したわ… GOOGLE_MAPS_API_KEYの設定、もう一回確認してくれるか？');
}

/**
 * 地名から場所の候補リストを取得する
 * @param {string} address - ユーザーが入力した地名
 * @returns {Promise<Array|null>} 場所の候補オブジェクトの配列
 */
async function searchLocations(address) {
    if (!mapsClient) return null;
    try {
        const response = await mapsClient.geocode({
            params: {
                address: address,
                language: 'ja',
                region: 'jp',
                key: process.env.GOOGLE_MAPS_API_KEY
            },
            timeout: 2000,
        });
        if (response.data.status !== 'OK') return [];
        return response.data.results
            .map(result => {
                if (!result.address_components || result.address_components.length === 0) return null;
                return {
                    placeId: result.place_id,
                    lat: result.geometry.location.lat,
                    lng: result.geometry.location.lng,
                    locationForWeather: `${result.address_components[0].long_name},JP`,
                    formattedAddress: result.formatted_address,
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error(`Geocoding APIでエラーが発生: ${address}`, error.message);
        return null;
    }
}

/**
 * 駅名から、駅の番地（プレイスID）を取得する
 * @param {string} stationName - ユーザーが入力した駅名
 * @returns {Promise<string|null>}
 */
async function findPlaceIdForStation(stationName) {
    if (!mapsClient) return null;
    try {
        const response = await mapsClient.findPlaceFromText({
            params: {
                input: stationName,
                inputtype: 'textquery',
                fields: ['place_id'],
                language: 'ja',
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        if (response.data.status !== 'OK' || response.data.candidates.length === 0) {
            return null;
        }
        return response.data.candidates[0].place_id;
    } catch (error) {
        console.error(`Places APIでエラーが発生: ${stationName}`, error.message);
        return null;
    }
}

module.exports = {
    searchLocations,
    findPlaceIdForStation,
};
