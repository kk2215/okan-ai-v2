// test-google-api.js - Google APIとの連携をテストするためだけの実験室

// .envファイルから環境変数を読み込む（APIキーのため）
require('dotenv').config();

const { Client } = require("@googlemaps/google-maps-services-js");

// --- ここから実験開始 ---

async function runTest() {
    console.log('--- Google API 連携テスト開始 ---');

    if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.error('アカン！GOOGLE_MAPS_API_KEYが設定されてへんで！');
        return;
    }

    const mapsClient = new Client({});
    const fromStation = '板橋駅';
    const toStation = '六本木駅';

    try {
        // --- 実験１：駅探しのプロに、番地（プレイスID）を聞いてみる ---
        console.log(`\n[実験1] 駅探しのプロ(Places API)に、「${fromStation}」と「${toStation}」の番地を聞いてみるで…`);
        
        const findFromPlaceRequest = {
            params: {
                input: fromStation,
                inputtype: 'textquery',
                fields: ['place_id', 'name'],
                language: 'ja',
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        };
        const findToPlaceRequest = { ...findFromPlaceRequest, params: { ...findFromPlaceRequest.params, input: toStation }};

        const [fromResponse, toResponse] = await Promise.all([
            mapsClient.findPlaceFromText(findFromPlaceRequest),
            mapsClient.findPlaceFromText(findToPlaceRequest)
        ]);

        if (fromResponse.data.status !== 'OK' || toResponse.data.status !== 'OK' || fromResponse.data.candidates.length === 0 || toResponse.data.candidates.length === 0) {
            console.error('アカン！駅の番地が見つからんかったわ…');
            console.log('「板橋駅」の結果:', fromResponse.data);
            console.log('「六本木駅」の結果:', toResponse.data);
            return;
        }

        const fromPlaceId = fromResponse.data.candidates[0].place_id;
        const toPlaceId = toResponse.data.candidates[0].place_id;
        console.log(`[実験1成功！] 「${fromStation}」の番地は ${fromPlaceId} やな。`);
        console.log(`[実験1成功！] 「${toStation}」の番地は ${toPlaceId} やな。`);

        // --- 実験２：プロのナビはんに、番地で道案内を頼んでみる ---
        console.log(`\n[実験2] プロのナビはん(Directions API)に、番地で道案内を頼んでみるで…`);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        const departureTime = Math.floor(tomorrow.getTime() / 1000);

        const directionsRequest = {
            params: {
                origin: `place_id:${fromPlaceId}`,
                destination: `place_id:${toPlaceId}`,
                mode: 'transit',
                language: 'ja',
                region: 'jp',
                departure_time: departureTime,
                key: process.env.GOOGLE_MAPS_API_KEY
            },
        };

        const directionsResponse = await mapsClient.directions(directionsRequest);

        if (directionsResponse.data.status !== 'OK' || directionsResponse.data.routes.length === 0) {
            console.error('アカン！ナビはん、道を教えてくれへんかった…');
            console.log('ナビはんの返事:', directionsResponse.data);
            return;
        }

        const allLines = new Set();
        directionsResponse.data.routes.forEach(route => {
            route.legs.forEach(leg => {
                leg.steps.forEach(step => {
                    if (step.travel_mode === 'TRANSIT' && step.transit_details) {
                        allLines.add(step.transit_details.line.name);
                    }
                });
            });
        });

        console.log('🎉🎉🎉 [実験大成功！] 見つかった路線はこれや！ 🎉🎉🎉');
        console.log(Array.from(allLines));
        console.log('\n--- Google API 連携テスト完了 ---');


    } catch (error) {
        console.error('！！！実験中に、とんでもないエラーが出てもうたわ！！！');
        if (error.response) {
            console.error('エラーの詳細:', error.response.data);
        } else {
            console.error(error);
        }
    }
}

runTest();
