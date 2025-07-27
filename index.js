// ----------------------------------------------------------------
// 1. ライブラリの読み込み
// ----------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');
const cron = require('node-cron');
const chrono = require('chrono-node');
const { Pool } = require('pg');
const cheerio = require('cheerio');
const { formatInTimeZone } = require('date-fns-tz');

// ----------------------------------------------------------------
// 2. 設定
// ----------------------------------------------------------------
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const OPEN_WEATHER_API_KEY = process.env.OPEN_WEATHER_API_KEY;

const client = new Client(config);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------------------------------------------------------
// 3. データベース関数
// ----------------------------------------------------------------
const getUser = async (userId) => {
  try {
    const res = await pool.query('SELECT data FROM users WHERE user_id = $1', [userId]);
    return res.rows[0] ? res.rows[0].data : null;
  } catch (error) { console.error('DB Error on getUser:', error); return null; }
};
const createUser = async (userId) => {
  const newUser = {
    setupState: 'awaiting_location', location: null, prefecture: null, lat: null, lon: null,
    notificationTime: null, trainLines: [],
    garbageDay: {}, reminders: [], temp: {},
  };
  await pool.query('INSERT INTO users (user_id, data) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET data = $2', [userId, newUser]);
  return newUser;
};
const updateUser = async (userId, userData) => {
  await pool.query('UPDATE users SET data = $1 WHERE user_id = $2', [userData, userId]);
};

// ----------------------------------------------------------------
// 4. 各機能の部品 (ヘルパー関数)
// ----------------------------------------------------------------
const getGeoInfo = async (locationName) => {
  try {
    const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
      params: { q: `${locationName},JP`, limit: 1, appid: OPEN_WEATHER_API_KEY }
    });
    return (response.data && response.data.length > 0) ? response.data[0] : null;
  } catch (error) { console.error("Geocoding API Error:", error.response?.data || error.message); return null; }
};
const getWeather = async (user) => {
  if (!user || !user.lat || !user.lon) return 'ごめん、天気を調べるための地域が設定されてへんわ。';
  try {
    const response = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: { lat: user.lat, lon: user.lon, exclude: 'minutely,hourly,alerts', units: 'metric', lang: 'ja', appid: OPEN_WEATHER_API_KEY }
    });
    const today = response.data.daily[0];
    const description = today.weather[0].description;
    const maxTemp = Math.round(today.temp.max);
    const minTemp = Math.round(today.temp.min);
    let message = `今日の${user.location}の天気は「${description}」やで。\n最高気温は${maxTemp}度、最低気温は${minTemp}度くらいになりそうや。`;
    if (maxTemp >= 30) { message += '\n暑いから水分補給しっかりしよし！'; }
    if (today.pop > 0.5) { message += '\n雨が降りそうやから、傘持って行った方がええよ！☔'; }
    return message;
  } catch (error) { console.error("Weather API Error:", error.response?.data || error.message); return 'ごめん、天気予報の取得に失敗してもうた…'; }
};
const findStation = async (stationName) => {
  try {
    const response = await axios.get('http://express.heartrails.com/api/json', { params: { method: 'getStations', name: stationName } });
    return response.data.response.station || [];
  } catch (error) { console.error("駅情報APIエラー:", error); return []; }
};
const getTrainStatus = async (trainLineName) => {
  const lineUrlMap = {
    '山手線': 'https://transit.yahoo.co.jp/diainfo/line/21/0', '埼京線': 'https://transit.yahoo.co.jp/diainfo/line/31/0',
    '西武池袋線': 'https://transit.yahoo.co.jp/diainfo/line/158/0', '東京メトロ副都心線': 'https://transit.yahoo.co.jp/diainfo/line/456/0'
  };
  const url = lineUrlMap[trainLineName];
  if (!url) { return `・${trainLineName}：運行情報URL未登録`; }
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const status = $('#mdServiceStatus dt').text().trim();
    return `・${trainLineName}：『${status}』`;
  } catch (error) { console.error("Train Info Scraping Error:", error); return `・${trainLineName}：情報取得エラー`; }
};
const getRecipe = () => {
  const hour = new Date().getHours();
  let meal, mealType;
  if (hour >= 4 && hour < 11) { [meal, mealType] = ['朝ごはん', ['トースト', 'おにぎり']]; }
  else if (hour >= 11 && hour < 16) { [meal, mealType] = ['お昼ごはん', ['うどん', 'パスタ']]; }
  else { [meal, mealType] = ['晩ごはん', ['カレー', '唐揚げ']]; }
  const recipe = mealType[Math.floor(Math.random() * mealType.length)];
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(recipe + ' 簡単 作り方')}`;
  return { type: 'text', text: `今日の${meal}は「${recipe}」なんてどう？\n作り方はこのあたりが参考になるかも！\n${searchUrl}` };
};

// ----------------------------------------------------------------
// 5. 定期実行するお仕事 (スケジューラー)
// ----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
  try {
    const res = await pool.query("SELECT user_id, data FROM users WHERE data->>'setupState' = 'complete'");
    for (const row of res.rows) {
      const userId = row.user_id;
      const user = row.data;
      let morningMessage = 'おはよー！朝やで！\n';
      const weatherInfo = await getWeather(user);
      morningMessage += `\n${weatherInfo}\n`;
      if (user.trainLines && user.trainLines.length > 0) {
        morningMessage += '\n【電車の運行状況】';
        for (const line of user.trainLines) {
          const trainInfo = await getTrainStatus(line);
          morningMessage += `\n${trainInfo}`;
        }
      }
      const todayIndex = new Date().getDay();
      const garbageInfo = user.garbageDay[todayIndex];
      if (garbageInfo) { morningMessage += `\n\n今日は「${garbageInfo}」の日やで！忘れんといてや！🚮`; }
      await client.pushMessage(userId, { type: 'text', text: morningMessage });
    }
  } catch (err) { console.error('朝の通知処理でエラー:', err); }
}, { timezone: "Asia/Tokyo" });

cron.schedule('* * * * *', async () => {
  try {
    const res = await pool.query("SELECT user_id, data FROM users WHERE jsonb_array_length(data->'reminders') > 0");
    for (const row of res.rows) {
      const userId = row.user_id;
      const user = row.data;
      const now = new Date();
      const dueReminders = [];
      const remainingReminders = [];
      (user.reminders || []).forEach(reminder => {
        if (new Date(reminder.date) <= now) { dueReminders.push(reminder); } 
        else { remainingReminders.push(reminder); }
      });
      if (dueReminders.length > 0) {
        user.reminders = remainingReminders;
        await updateUser(userId, user);
        for (const reminder of dueReminders) {
          await client.pushMessage(userId, { type: 'text', text: `おかんやで！時間やで！\n\n「${reminder.task}」\n\n忘れたらあかんで！` });
        }
      }
    }
  } catch (err) { console.error('リマインダー処理でエラー:', err); }
}, { timezone: "Asia/Tokyo" });

// 6. LINEからのメッセージを処理するメインの部分【リマインダー機能最終版】
const handleEvent = async (event) => {
  const userId = event.source.userId;

  if (event.type === 'follow') {
    await createUser(userId);
    return client.replyMessage(event.replyToken, { type: 'text', text: '友達追加ありがとうな！設定を始めるで！\n「天気予報」に使う市区町村の名前を教えてな。（例：練馬区）'});
  }
  if (event.type !== 'message' || event.message.type !== 'text') { return null; }
  
  const userText = event.message.text.trim();
  let user = await getUser(userId);

  if (!user || userText === 'リセット') {
    user = await createUser(userId);
    return client.replyMessage(event.replyToken, { type: 'text', text: '初めまして！設定を始めるで！\n「天気予報」に使う市区町村の名前を教えてな。（例：練馬区）'});
  }

  if (user.setupState && user.setupState !== 'complete') {
    // ... (設定フローのswitch文は、以前の完全版コードと同じです) ...
  } else {
    // 設定完了後の会話処理

    // ▼▼▼ このifブロックを丸ごと置き換えてください ▼▼▼
    if (userText.includes('リマインド') || userText.includes('思い出させて')) {
      // まず、文章から「〇〇ってリマインドして」のような命令部分を取り除く
      let textToParse = userText;
      const triggerWords = ["ってリマインドして", "と思い出させて", "ってリマインド", "と思い出させ"];
      triggerWords.forEach(word => {
        if (textToParse.endsWith(word)) {
          textToParse = textToParse.slice(0, -word.length);
        }
      });
      
      // 日本の現在時刻を基準点として設定
      const japanTimeZone = 'Asia/Tokyo';
      const nowInJapan = new Date(); // new Date()はUTC基準だが、chronoはこれを正しく扱える

      // 残った文章（「明日の15時に歯医者」など）から、日時を解析する
      const results = chrono.ja.parse(textToParse, nowInJapan, { forwardDate: true });

      if (results.length > 0) {
        const reminderDate = results[0].start.date();
        // 解析された日時部分を、さらに文章から取り除いて、純粋なタスク内容を抽出する
        const task = textToParse.replace(results[0].text, '').trim().replace(/^[にでをは、。]/, '').trim();

        if (task) {
          user.reminders.push({ date: reminderDate.toISOString(), task });
          await updateUser(userId, user);
          const formattedDate = formatInTimeZone(reminderDate, japanTimeZone, 'yyyy/MM/dd HH:mm');
          return client.replyMessage(event.replyToken, { type: 'text', text: `あいよ！\n${formattedDate}に「${task}」やね。覚えとく！` });
        }
      }
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    if (userText.includes('ご飯') || userText.includes('ごはん')) {
      return client.replyMessage(event.replyToken, getRecipe());
    }
    return client.replyMessage(event.replyToken, { type: 'text', text: 'うんうん。' });
  }
};

// ----------------------------------------------------------------
// 7. サーバーを起動
// ----------------------------------------------------------------
const setupDatabase = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (user_id VARCHAR(255) PRIMARY KEY, data JSONB);`);
};
const app = express();
const PORT = process.env.PORT || 3000;
app.post('/webhook', middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error("▼▼▼ 致命的なエラーが発生しました ▼▼▼", err);
      if (req.body.events && req.body.events[0]?.replyToken) {
        client.replyMessage(req.body.events[0].replyToken, { type: 'text', text: 'ごめん、ちょっと調子が悪いみたい…。' });
      }
      res.status(500).end();
    });
});
app.get('/', (req, res) => res.send('Okan AI is running!'));
app.listen(PORT, async () => {
  await setupDatabase();
  console.log(`おかんAI、ポート${PORT}で待機中...`);
});