// services/firestore.js - Firebase Firestoreと通信する担当

const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore'); // これを追加

let db;

/**
 * Firestoreデータベースを初期化する
 */
function initializeDb() {
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
        }

        // 環境変数からサービスアカウント情報を読み込む
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        // すでに初期化されているかチェック
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        db = admin.firestore();
        console.log('おかん、Firebaseの記憶装置に接続したわよ！');

    } catch (error) {
        console.error('Firebaseの初期化に失敗したわ…。設定を確認してちょうだい。', error);
        process.exit(1);
    }
}

/**
 * Firestoreのインスタンスを取得する
 * @returns {FirebaseFirestore.Firestore} Firestoreのインスタンス
 */
function getDb() {
    if (!db) {
        throw new Error('Firestore is not initialized.');
    }
    return db;
}

module.exports = {
    initializeDb,
    getDb,
    FieldValue, // これをエクスポート
};
