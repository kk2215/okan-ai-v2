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
 * 駅名から、その駅を通る路線一覧を取得する（賢い版）
 * @param {string} stationName - 駅名
 * @returns {Promise<string[]|null>} 路線名の配列
 */
async function getLinesForStation(stationName) {
    if (!API_KEY) { return null; }
    
    // まずは入力された名前そのままで検索してみる
    let lines = await searchStation(stationName);

    // もし見つからんかったら、後ろに「駅」を付けてもう一回探す
    if (!lines || lines.length === 0) {
        console.log(`「${stationName}」で見つからんかったから、「${stationName}駅」で再検索するで。`);
        lines = await searchStation(stationName + '駅');
    }

    return lines;
}

/**
 * 駅すぱあとAPIを叩いて駅情報を検索する内部関数
 * @param {string} nameToSearch - 検索する駅名
 * @returns {Promise<string[]|null>}
 */
async function searchStation(nameToSearch) {
    try {
        const response = await axios.get('https://api.ekispert.jp/v1/json/station', {
            params: {
                key: API_KEY,
                name: nameToSearch,
                type: 'train'
            }
        });

        const points = response.data.ResultSet.Point;
        if (!points) return [];

        const allLines = [];
        const pointArray = Array.isArray(points) ? points : [points]; 
        
        pointArray.forEach(point => {
            if (point.Station && point.Station.Line) {
                const lines = Array.isArray(point.Station.Line) ? point.Station.Line : [point.Station.Line];
                lines.forEach(line => {
                    allLines.push(line.Name);
                });
            }
        });
        
        return [...new Set(allLines)];

    } catch (error) {
        // 404 Not Foundのようなエラーは、ここでは「見つからなかった」として扱う
        if (error.response && error.response.status !== 200) {
            console.warn(`駅検索でAPIエラーが発生したけど、処理は続けるで: ${nameToSearch} (Status: ${error.response.status})`);
            return null;
        }
        // それ以外の致命的なエラーはちゃんとログに出す
        console.error(`駅情報の取得で致命的なエラーが発生: ${nameToSearch}`, error.message);
        return null; // エラー時はnullを返す
    }
}


module.exports = {
    fetchTrainStatus,
    getLinesForStation,
};
