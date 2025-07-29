// services/train.js - 電車の運行情報を取得する専門家 (一時休業中)

const axios = require('axios');

const API_KEY = process.env.EKISPERT_API_KEY; // 駅すぱあとAPIキー

/**
 * 指定された路線名の運行情報を取得する
 * @param {string[]} lineNames - 路線名の配列
 * @returns {Promise<Array|null>} 運行情報オブジェクトの配列
 */
async function fetchTrainStatus(lineNames) {
    // APIキーがまだないから、今は何もしないでおく
    if (!API_KEY) {
        // console.log('駅すぱあとのAPIキーがないから、電車情報はお休みやで。');
        return null; // nullを返しておけば、エラーにはならん
    }
    
    const results = [];

    for (const name of lineNames) {
        try {
            const response = await axios.get('https://api.ekispert.jp/v1/json/operationLine/info', {
                params: {
                    key: API_KEY,
                    name: name,
                }
            });

            if (response.data.ResultSet.Information) {
                const info = response.data.ResultSet.Information;
                results.push({
                    lineName: info.Line.Name,
                    status: info.Status.Text,
                    detail: info.Status.Detail,
                });
            } else {
                 results.push({
                    lineName: name,
                    status: '平常運転',
                    detail: '運行情報はありません。',
                });
            }
        } catch (error) {
            console.error(`運行情報の取得に失敗したわ… 路線: ${name}`, error.response ? error.response.data : error.message);
            results.push({
                lineName: name,
                status: '情報取得失敗',
                detail: '運行情報を確認できませんでした。',
            });
        }
    }
    return results;
}

module.exports = {
    fetchTrainStatus
};
