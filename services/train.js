// services/train.js - 電車の運行情報・経路情報を取得する専門家

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
 * 出発地と目的地から経路を検索する
 * @param {string} from - 出発駅
 * @param {string} to - 到着駅
 * @returns {Promise<Array|null>} 経路情報の配列
 */
async function findRoutes(from, to) {
    if (!API_KEY) { return null; }
    try {
        const response = await axios.get('https://api.ekispert.jp/v1/json/search/course/extreme', {
            params: {
                key: API_KEY,
                viaList: `${from}:${to}`, // 「出発駅:到着駅」の形式
                searchType: 'departure', // 今すぐ出発で検索
                plane: false, // 飛行機は除外
                shinkansen: false, // 新幹線も除外
            }
        });

        const courses = response.data.ResultSet.Course;
        if (!courses) return [];

        // 複数の経路が見つかることがあるので、配列で返す
        // 扱いやすいように、必要な情報だけ抜き出す
        return courses.map((course, index) => {
            const route = course.Route;
            const lines = route.Line.map(line => line.Name);
            return {
                index: index,
                summary: course.Teiki.Summary, // 「平日1ヶ月 10,250円」のようなテキスト
                time: route.timeOnBoard, // 所要時間（分）
                transfers: route.transferCount, // 乗り換え回数
                lines: [...new Set(lines)] // 重複を除いた路線名の配列
            };
        });

    } catch (error) {
        console.error(`経路検索に失敗: ${from} -> ${to}`, error.message);
        return null;
    }
}

module.exports = {
    fetchTrainStatus,
    findRoutes, // 新しい関数を追加
};
