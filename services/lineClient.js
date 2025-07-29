// services/lineClient.js - LINE SDKクライアントを初期化・管理する専門家

const line = require('@line/bot-sdk');

let client;

/**
 * LINEクライアントを初期化する
 * @param {object} config - { channelAccessToken, channelSecret }
 */
function initializeApp(config) {
    if (!config.channelAccessToken || !config.channelSecret) {
        console.error('LINEのアクセストークンとシークレットが設定されてへんで！');
        throw new Error('LINE Channel Access Token and Channel Secret must be provided.');
    }
    client = new line.Client(config);
    console.log('LINEの担当者、準備OKやで！');
}

/**
 * 初期化済みのLINEクライアントを取得する
 * @returns {object} LINEクライアントのインスタンス
 */
function getClient() {
    if (!client) {
        throw new Error('LINEクライアントがまだ準備できてへんわ。initializeAppを先に呼んでな。');
    }
    return client;
}

module.exports = {
    initializeApp,
    getClient,
};
