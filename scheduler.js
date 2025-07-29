// scheduler.js - 毎朝の定時通知を管理する責任者

const cron = require('node-cron');
const { getDb } = require('./services/firestore');
const { getClient } = require('./services/lineClient');
const { getReminders } = require('./services/reminder');
const { fetchWeather } = require('./services/weather');
const { fetchTrainStatus } = require('./services/train');
const { createMorningMessage } = require('./templates/morningNotificationMessage');
const { format, utcToZonedTime } = require('date-fns-tz');

const TIME_ZONE = 'Asia/Tokyo';

/**
 * スケジューラーを初期化して、定時実行を開始する
 */
function initializeScheduler() {
    console.log('スケジュール管理の責任者、スタンバイOKやで！');

    // 毎分実行（'*/1 * * * *' でもええけど、'* * * * *' の方が分かりやすいな）
    cron.schedule('* * * * *', async () => {
        const nowInTokyo = utcToZonedTime(new Date(), TIME_ZONE);
        const currentTime = format(nowInTokyo, 'HH:mm');
        const currentDay = nowInTokyo.getDay(); // 0:日曜, 1:月曜...

        console.log(`[${currentTime}] おかん、見回り中...`);

        try {
            const db = getDb();
            const client = getClient();
            
            // 1. 通知時間になったユーザーを探す
            const usersSnapshot = await db.collection('users')
                                          .where('notificationTime', '==', currentTime)
                                          .get();

            if (usersSnapshot.empty) {
                return; // 起こす子がおらんかったら、見回り終わり
            }

            // 2. 該当するユーザーそれぞれに通知を作る
            for (const userDoc of usersSnapshot.docs) {
                const user = userDoc.data();
                const userId = user.userId;

                console.log(`[${currentTime}] ${user.displayName}ちゃんを起こす時間や！`);

                // 3. 必要な情報を集める
                // 天気情報
                const weatherInfo = user.location ? await fetchWeather(user.location) : null;
                
                // 電車情報 (複数路線に対応)
                const trainInfo = user.trainLines && user.trainLines.length > 0 
                                ? await fetchTrainStatus(user.trainLines) 
                                : null;

                // 今日のゴミの日情報
                const allReminders = await getReminders(userId);
                const garbageInfo = allReminders.filter(r => r.dayOfWeek === currentDay);

                // 4. 通知メッセージを組み立てて送信
                const morningMessage = createMorningMessage({ user, weatherInfo, trainInfo, garbageInfo });
                await client.pushMessage(userId, morningMessage);
                
                console.log(`[${currentTime}] ${user.displayName}ちゃんにお知らせを送ったで！`);
            }

        } catch (error) {
            console.error('朝のお知らせ準備中にエラーが出てもうたわ…', error);
        }
    });
}

module.exports = {
    initializeScheduler
};
