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

        const allLines = new Set();
        stations.forEach(station => {
            // ★★★ ここが修正ポイントや！ ★★★
            // 路線が1本だけの場合、文字列で返ってくる。複数ある場合は配列。
            // どっちの場合でもええように、必ず配列として扱うようにするんや。
            if (station.line) {
                const lines = Array.isArray(station.line) ? station.line : [station.line];
                
                lines.forEach(line => {
                    allLines.add(line);
                });
            }
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
