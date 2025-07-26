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
    notificationTime: null, 
    trainLines: [], // ★ 単数形から複数形に変更し、配列として初期化
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
      params: { q: `${locationName},JP`, limit: 5, appid: process.env.OPEN_WEATHER_API_KEY }
    });
    // APIからの応答が配列であることを確認し、そうでなければ空の配列を返す
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) { 
    console.error("OpenWeatherMap Geocoding API Error:", error.response?.data || error.message); 
    return []; // エラーの場合も必ず空の配列を返す
  }
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

cron.schedule('* * * * *', async () => { /* ... (リマインダー処理は変更なし) ... */ });

// 6. LINEからのメッセージを処理するメインの部分
const handleEvent = async (event) => {
  if (event.type === 'follow') {
    const userId = event.source.userId;
    await createUser(userId);
    return client.replyMessage(event.replyToken, { type: 'text', text: '友達追加ありがとうな！設定を始めるで！\n「天気予報」に使う市区町村の名前を教えてな。（例：練馬区）'});
  }
  if (event.type !== 'message' || event.message.type !== 'text') { return null; }
  const userId = event.source.userId;
  const userText = event.message.text.trim();

  if (userText === 'リセット') {
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    await createUser(userId);
    return client.replyMessage(event.replyToken, { type: 'text', text: '設定をリセットして、新しく始めるで！\n「天気予報」に使う市区町村の名前を教えてな。（例：練馬区）'});
  }
  let user = await getUser(userId);
  if (!user) {
    user = await createUser(userId);
    return client.replyMessage(event.replyToken, { type: 'text', text: '初めまして！設定を始めるで！\n「天気予報」に使う市区町村の名前を教えてな。（例：練馬区）'});
  }

  if (user.setupState && user.setupState !== 'complete') {
    switch (user.setupState) {
      case 'awaiting_location': {
        const locations = await getGeoInfo(userText);
        if (locations.length === 0) { return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、その地名は見つけられへんかったわ。もう一度教えてくれる？' }); }
        if (locations.length === 1) {
          const result = locations[0];
          user.location = result.local_names?.ja || result.name;
          user.prefecture = result.state;
          user.lat = result.lat; user.lon = result.lon;
          user.setupState = 'awaiting_time';
          await updateUser(userId, user);
          return client.replyMessage(event.replyToken, { type: 'text', text: `おおきに！地域は「${user.location}」で覚えたで。\n\n次は、毎朝の通知は何時がええ？` });
        }
        user.temp = { location_candidates: locations };
        user.setupState = 'awaiting_prefecture_clarification';
        await updateUser(userId, user);
        const prefectures = [...new Set(locations.map(loc => loc.state).filter(Boolean))];
        if (prefectures.length <= 1) {
            const result = locations[0];
            user.location = result.local_names?.ja || result.name;
            user.prefecture = result.state;
            user.lat = result.lat; user.lon = result.lon;
            user.setupState = 'awaiting_time';
            await updateUser(userId, user);
            return client.replyMessage(event.replyToken, { type: 'text', text: `おおきに！地域は「${user.location}」で覚えたで。\n\n次は、毎朝の通知は何時がええ？` });
        }
        return client.replyMessage(event.replyToken, { type: 'text', text: `「${userText}」やね。いくつか候補があるみたいやけど、どの都道府県のこと？`, quickReply: { items: prefectures.map(p => ({ type: 'action', action: { type: 'message', label: p, text: p } })) }});
      }
      case 'awaiting_prefecture_clarification': {
        // ▼▼▼ この部分を、より安全なコードに修正しました ▼▼▼
        const candidates = Array.isArray(user.temp?.location_candidates) ? user.temp.location_candidates : [];
        const chosen = candidates.find(loc => loc.state === userText);
        
        if (!chosen) { 
          return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、下のボタンから選んでくれるかな？' }); 
        }
        
        user.location = chosen.local_names?.ja || chosen.name;
        user.prefecture = chosen.state;
        user.lat = chosen.lat; 
        user.lon = chosen.lon;
        user.setupState = 'awaiting_time';
        delete user.temp;
        await updateUser(userId, user);
        return client.replyMessage(event.replyToken, { type: 'text', text: `おおきに！地域は「${user.location}」で覚えたで。\n\n次は、毎朝の通知は何時がええ？` });
      }
      case 'awaiting_time': {
        user.notificationTime = userText;
        user.setupState = 'awaiting_route';
        await updateUser(userId, user);
        return client.replyMessage(event.replyToken, { type: 'text', text: `了解！朝の通知は「${userText}」やね。\n\n次は、普段利用する経路を「〇〇から〇〇」のように教えてくれる？` });
      }
      case 'awaiting_route': {
        const match = userText.match(/(.+)から(.+)/);
        if (!match) { return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、「〇〇から〇〇」の形で教えてな。' }); }
        const [ , departureName, arrivalName ] = match;
        const departureQuery = departureName.trim().endsWith('駅') ? departureName.trim() : `${departureName.trim()}駅`;
        const arrivalQuery = arrivalName.trim().endsWith('駅') ? arrivalName.trim() : `${arrivalName.trim()}駅`;
        const routeResult = await getRouteInfo(departureQuery, arrivalQuery);
        if (typeof routeResult === 'string') { return client.replyMessage(event.replyToken, { type: 'text', text: routeResult }); }
        user.departureStation = departureName.trim();
        user.arrivalStation = arrivalName.trim();
        if (routeResult.lines.length === 1) {
          user.trainLine = routeResult.lines[0];
          user.setupState = 'awaiting_garbage';
          await updateUser(userId, user);
          return client.replyMessage(event.replyToken, { type: 'text', text: `${routeResult.message}\n\n最後に、ゴミの日を教えてくれる？` });
        } else {
          user.temp = { line_candidates: routeResult.lines };
          user.setupState = 'awaiting_primary_line';
          await updateUser(userId, user);
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `${routeResult.message}\n\nところで、毎朝の運行状況は、どの路線を一番気にしてる？ボタンで教えてな。`,
            quickReply: { items: routeResult.lines.map(l => ({ type: 'action', action: { type: 'message', label: l, text: l } })) }
          });
        }
      }
      case 'awaiting_primary_line': {
        const candidates = user.temp.line_candidates || [];
        if (!candidates.includes(userText)) {
          return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、下のボタンから選んでくれるかな？' });
        }
        user.trainLine = userText;
        user.setupState = 'awaiting_garbage';
        delete user.temp;
        await updateUser(userId, user);
        return client.replyMessage(event.replyToken, { type: 'text', text: `「${user.trainLine}」やね、覚えたで！\n\n最後に、ゴミの日を教えてくれる？` });
      }
      case 'awaiting_garbage': {
        if (userText.includes('おわり') || userText.includes('終わり') || userText.includes('なし')) {
          user.setupState = 'complete';
          await updateUser(userId, user);
          return client.replyMessage(event.replyToken, { type: 'text', text: '設定おおきに！これで全部や！' });
        }
        const garbageMatches = userText.matchAll(/(.+?ゴミ)は?(\S+?)曜日?/g);
        let found = false;
        for (const match of garbageMatches) {
          const [ , garbageType, dayOfWeek ] = match;
          const dayMap = { '日':0, '月':1, '火':2, '水':3, '木':4, '金':5, '土':6 };
          if (dayMap[dayOfWeek] !== undefined) {
            user.garbageDay[dayMap[dayOfWeek]] = garbageType.trim();
            found = true;
          }
        }
        if (found) {
          await updateUser(userId, user);
          return client.replyMessage(event.replyToken, { type: 'text', text: `了解！他にもあったら教えてな。（終わったら「おわり」か「終わり」と入力）` });
        } else {
          return client.replyMessage(event.replyToken, { type: 'text', text: 'ごめん、うまく聞き取れへんかったわ。「〇〇ゴミは△曜日」の形で教えてくれる？' });
        }
      }
    }
  } else {
    // 設定完了後の会話処理
    if (userText.includes('リマインド') || userText.includes('思い出させて')) {
      let textToParse = userText;
      const triggerWords = ["ってリマインドして", "と思い出させて", "ってリマインド", "と思い出させ"];
      triggerWords.forEach(word => { textToParse = textToParse.replace(new RegExp(word + '$'), ''); });
      const now = new Date();
      const results = chrono.ja.parse(textToParse, now, { forwardDate: true });
      if (results.length > 0) {
        const reminderDate = results[0].start.date();
        const task = textToParse.replace(results[0].text, '').trim().replace(/^[にでをは]/, '').trim();
        if (task) {
          user.reminders.push({ date: reminderDate.toISOString(), task });
          await updateUser(userId, user);
          const formattedDate = formatInTimeZone(reminderDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
          return client.replyMessage(event.replyToken, { type: 'text', text: `あいよ！\n${formattedDate}に「${task}」やね。覚えとく！` });
        }
      }
    }
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
app.listen(PORT, async () => {
  await setupDatabase();
  console.log(`おかんAI、ポート${PORT}で待機中...`);
});