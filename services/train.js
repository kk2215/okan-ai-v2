// services/train.js - 電車の運行情報・駅情報を取得する専門家

const axios = require('axios');

const API_KEY = process.env.EKISPERT_API_KEY;

/**
 * 指定された路線名の運行情報を取得する
 * @param {string[]} lineNames - 路線名の配列
 * @returns {Promise<Array|null>} 運行情報オブジェクトの配列
 */
async function fetchTrainStatus(lineNames) {
    if (!API_KEY) { return null; }
    const results = [];
    for (const name of lineNames) {
        try {
            const response = await axios.get('https://api.ekispert.jp/v1/json/operationLine/info', { params: { key: API_KEY, name: name } });
            if (response.data.ResultSet.Information) {
                const info = response.data.ResultSet.Information;
                results.push({ lineName: info.Line.Name, status: info.Status.Text, detail: info.Status.Detail });
            } else {
                results.push({ lineName: name, status: '平常運転', detail: '運行情報はありません。' });
            }
        } catch (error) {
            console.error(`運行情報の取得に失敗 路線: ${name}`, error.message);
            results.push({ lineName: name, status: '情報取得失敗', detail: '運行情報を確認できませんでした。' });
        }
    }
    return results;
}

/**
 * 駅名から、その駅を通る路線一覧を取得する
 * @param {string} stationName - 駅名
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesForStation(stationName) {
    if (!API_KEY) { return null; }
    try {
        const response = await axios.get('https://api.ekispert.jp/v1/json/station', {
            params: {
                key: API_KEY,
                name: stationName,
                type: 'train' // 電車に限定
            }
        });

        const points = response.data.ResultSet.Point;
        if (!points) return [];

        // 複数の駅が見つかる場合もあるので、全駅の全路線を合体させる
        const allLines = [];
        // Pointが単一オブジェクトか配列かAPIの仕様で変わるので、両対応しとく
        const pointArray = Array.isArray(points) ? points : [points]; 
        
        pointArray.forEach(point => {
            if (point.Station.Line) {
                // Lineも単一か配列か分からんので、両対応
                const lines = Array.isArray(point.Station.Line) ? point.Station.Line : [point.Station.Line];
                lines.forEach(line => {
                    allLines.push(line.Name);
                });
            }
        });
        
        return [...new Set(allLines)]; // 重複を除いて返す

    } catch (error) {
        console.error(`駅情報の取得に失敗: ${stationName}`, error.message);
        return null;
    }
}


module.exports = {
    fetchTrainStatus,
    getLinesForStation, // 新しい関数
};
