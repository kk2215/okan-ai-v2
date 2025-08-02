// services/geocoding.js - Google Geocoding APIと通信する専門家

const { Client } = require("@googlemaps/google-maps-services-js");

let mapsClient;

if (process.env.GOOGLE_MAPS_API_KEY) {
    mapsClient = new Client({});
    console.log('地名のプロ（Googleはん）、厨房にお迎えしたで！');
} else {
    console.error('地名のプロを呼んでくるのに失敗したわ… GOOGLE_MAPS_API_KEYの設定、もう一回確認してくれるか？');
}

/**
 * 地名から場所の候補リストを取得する
 * @param {string} address - ユーザーが入力した地名
 * @returns {Promise<Array|null>} 場所の候補オブジェクトの配列
 */
async function searchLocations(address) {
    if (!mapsClient) {
        console.error('Maps Clientが準備できてへんから、場所は探されへんわ。');
        return null;
    }

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

        if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
            console.warn(`Geocoding APIで場所が見つからんかったわ: ${address}`, response.data.status);
            return [];
        }

        return response.data.results.map(result => ({
            // ★★★ 緯度と経度も一緒に返すようにしたで！ ★★★
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            locationForWeather: `${result.address_components[0].long_name},JP`,
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
