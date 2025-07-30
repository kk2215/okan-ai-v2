// services/geocoding.js - Google Geocoding APIと通信する専門家

const { Client } = require("@googlemaps/google-maps-services-js");

// ★★★ これが最後の作戦や！APIキーやのうて、ちゃんと紹介状(サービスアカウント)で挨拶する！ ★★★
let mapsClient;
let serviceAccountKey;

try {
    // Firebaseで使っとるのと同じサービスアカウント情報（紹介状）を読み込む
    serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Google Mapsのプロ用道具を準備
    mapsClient = new Client({});
    console.log('地名のプロ（Googleはん）、厨房にお迎えしたで！');

} catch (error) {
    console.error('地名のプロを呼んでくるのに失敗したわ… FIREBASE_SERVICE_ACCOUNTの設定、もう一回確認してくれるか？', error);
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
                key: serviceAccountKey.private_key // ★★★ ここで紹介状の代わりにAPIキーを使うんや！
            },
            timeout: 1000, // タイムアウトを1秒に設定
        });

        if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
            console.warn(`Geocoding APIで場所が見つからんかったわ: ${address}`, response.data.status);
            return [];
        }

        return response.data.results.map(result => ({
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
