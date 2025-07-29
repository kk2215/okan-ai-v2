// services/user.js - ユーザー情報のデータベース操作を担当

const { getDb, FieldValue } = require('./firestore');

const USERS_COLLECTION = 'users';

/**
 * 新しいユーザーを作成、または既存ユーザー情報を更新する
 * @param {object} userData - { userId, displayName, state? } を含むユーザーデータ
 */
async function saveUser(userData) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userData.userId);
    const initialData = {
        userId: userData.userId,
        displayName: userData.displayName,
        notificationTime: '07:00',
        location: null,
        trainLines: [],
        // ★★★ ここが修正ポイントや！ ★★★
        // 渡された状態があればそれを使い、なければnullにする
        state: userData.state || null,
        tempData: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    // setに { merge: true } をつけると、ドキュメントがなくても作成、あっても指定した項目だけ更新してくれる
    await userRef.set(initialData, { merge: true });
    console.log(`ユーザー情報を保存しました: ${userData.displayName} (${userData.userId})`);
}

/**
 * ユーザー情報を取得する
 * @param {string} userId - LINEのユーザーID
 * @returns {Promise<object|null>} ユーザーデータ、存在しない場合はnull
 */
async function getUser(userId) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) { return null; }
    return doc.data();
}

/**
 * ユーザーの状態を更新する
 * @param {string} userId - LINEのユーザーID
 * @param {string|null} state - 新しい状態
 * @param {object|null} tempData - 一時データ
 */
async function updateUserState(userId, state, tempData = null) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const updateData = {
        state: state,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (tempData) {
        updateData.tempData = tempData;
    } else if (tempData === null) {
        updateData.tempData = {};
    }
    await userRef.update(updateData);
    console.log(`ユーザーの状態を更新しました: ${userId} -> ${state}`);
}

/**
 * ユーザーの地域情報を更新する
 * @param {string} userId - LINEのユーザーID
 * @param {string|null} location - 新しい地域情報
 */
async function updateUserLocation(userId, location) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        location: location,
        updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`ユーザーの地域を更新しました: ${userId} -> ${location}`);
}

/**
 * ユーザーの通知時刻を更新する
 * @param {string} userId - LINEのユーザーID
 * @param {string} time - 新しい通知時刻 (HH:mm形式)
 */
async function updateUserNotificationTime(userId, time) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        notificationTime: time,
        updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`ユーザーの通知時刻を更新しました: ${userId} -> ${time}`);
}

/**
 * ユーザーの鉄道路線を保存する
 * @param {string} userId - LINEのユーザーID
 * @param {string[]} lines - 路線名の配列
 */
async function saveUserTrainLines(userId, lines) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        trainLines: lines,
        tempData: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`ユーザーの路線を更新しました: ${userId} -> ${lines.join(', ')}`);
}

module.exports = {
    saveUser,
    getUser,
    updateUserState,
    updateUserLocation,
    updateUserNotificationTime,
    saveUserTrainLines,
};
