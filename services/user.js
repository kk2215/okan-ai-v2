// services/user.js - ユーザー情報のデータベース操作を担当

const { getDb, FieldValue } = require('./firestore');

const USERS_COLLECTION = 'users';

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
 * 新しいユーザーを名簿に作成する（すでにおる場合は、名前だけ更新する）
 * @param {object} userData - { userId, displayName } を含むユーザーデータ
 */
async function saveUser(userData) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userData.userId);
    const doc = await userRef.get();

    // もしユーザーがすでにおったら、名前だけ更新する
    if (doc.exists) {
        if (doc.data().displayName !== userData.displayName) {
            await userRef.update({
                displayName: userData.displayName,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
        return;
    }

    // 新しいユーザーやったら、名簿を作る
    const initialData = {
        userId: userData.userId,
        displayName: userData.displayName,
        notificationTime: '07:00',
        location: null,
        lat: null,
        lng: null,
        trainLines: [],
        state: null, // ★★★ 状態は、必ずnullで作成する ★★★
        tempData: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    await userRef.set(initialData);
    console.log(`新しいユーザーを名簿に書いといたで: ${userData.displayName}`);
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
 * ユーザーの地域情報（緯度経度も）を更新する
 * @param {string} userId
 * @param {object} locationData - { location, lat, lng } を含む地域情報
 */
async function updateUserLocation(userId, locationData) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    
    const dataToUpdate = {
        location: locationData.location || null,
        lat: locationData.lat || null,
        lng: locationData.lng || null,
        updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.update(dataToUpdate);
    console.log(`ユーザーの地域を更新しました: ${userId} -> ${locationData.location}`);
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
    getUser,
    saveUser,
    updateUserState,
    updateUserLocation,
    updateUserNotificationTime,
    saveUserTrainLines,
};
