// services/user.js - ユーザー情報のデータベース操作を担当

const { getDb, FieldValue } = require('./firestore');

const USERS_COLLECTION = 'users';

async function saveUser(userData) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userData.userId);
    const initialData = {
        userId: userData.userId,
        displayName: userData.displayName,
        notificationTime: '07:00',
        location: null,
        trainLines: [],
        state: null,
        tempData: {}, // 一時的なデータを保存するポケットを追加
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    await userRef.set(initialData, { merge: true });
    console.log(`ユーザー情報を保存しました: ${userData.displayName} (${userData.userId})`);
}

async function getUser(userId) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) { return null; }
    return doc.data();
}

async function updateUserState(userId, state, tempData = null) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const updateData = {
        state: state,
        updatedAt: FieldValue.serverTimestamp(),
    };
    // 一時データも一緒に保存できるようにする
    if (tempData) {
        updateData.tempData = tempData;
    }
    await userRef.update(updateData);
    console.log(`ユーザーの状態を更新しました: ${userId} -> ${state}`);
}

async function updateUserLocation(userId, location) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        location: location,
        updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`ユーザーの地域を更新しました: ${userId} -> ${location}`);
}

async function updateUserNotificationTime(userId, time) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        notificationTime: time,
        updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`ユーザーの通知時刻を更新しました: ${userId} -> ${time}`);
}

async function saveUserTrainLines(userId, lines) {
    const db = getDb();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    await userRef.update({
        trainLines: lines,
        tempData: FieldValue.delete(), // 使った一時データは消しとく
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
