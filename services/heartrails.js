// services/heartrails.js - HeartRails Express APIと通信する専門家

const axios = require('axios');

const BASE_URL = 'http://express.heartrails.com/api/json';

/**
 * 駅名から、その駅を通る路線一覧を取得する
 * @param {string} stationName - 駅名
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesByStationName(stationName) {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                method: 'getStations',
                name: stationName,
            }
        });

        const stations = response.data.response.station;
        if (!stations) {
            return []; // 駅が見つからんかったら空っぽを返す
        }

        // 複数の駅が見つかる場合もあるので、全駅の全路線を合体させる
        const allLines = new Set();
        stations.forEach(station => {
            station.line.forEach(line => {
                // JR〇〇線 のように、会社名が付いてることが多いので、それもそのまま使う
                allLines.add(line);
            });
        });
        
        return Array.from(allLines);

    } catch (error) {
        console.error(`HeartRails APIでエラーが発生: ${stationName}`, error.message);
        return null;
    }
}

module.exports = {
    getLinesByStationName,
};
