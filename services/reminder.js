// services/reminder.js - リマインダー情報のデータベース操作を担当

const { getDb, FieldValue } = require('./firestore');
// もう時差ボケを直す道具には頼らへん！

const USERS_COLLECTION = 'users';
const REMINDERS_COLLECTION = 'reminders';

/**
 * 新しいリマインダーを保存する
 * @param {string} userId - LINEのユーザーID
 * @param {object} reminderData - { title, type, notificationTime, dayOfWeek, targetDate, baseDate } を含むリマインダーデータ
 */
async function saveReminder(userId, reminderData) {
    const db = getDb();
    const reminderRef = db.collection(USERS_COLLECTION).doc(userId)
                          .collection(REMINDERS_COLLECTION).doc();

    const dataToSave = {
        ...reminderData,
        userId: userId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        lastNotifiedAt: null,
    };
    
    // targetDateが文字列で来たらDateオブジェクトに変換
    if (dataToSave.targetDate && typeof dataToSave.targetDate === 'string') {
        dataToSave.targetDate = new Date(dataToSave.targetDate);
    }
    if (dataToSave.baseDate && typeof dataToSave.baseDate === 'string') {
        dataToSave.baseDate = new Date(dataToSave.baseDate);
    }

    await reminderRef.set(dataToSave);

    console.log(`リマインダーを保存しました: ${userId} -> ${reminderData.title}`);
}

/**
 * ユーザーの有効なリマインダーをすべて取得する
 * @param {string} userId - LINEのユーザーID
 * @returns {Promise<Array>} リマインダーの配列
 */
async function getReminders(userId) {
    const db = getDb();
    const snapshot = await db.collection(USERS_COLLECTION).doc(userId)
                             .collection(REMINDERS_COLLECTION)
                             .where('isActive', '==', true)
                             .get();
    
    if (snapshot.empty) { return []; }

    const reminders = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const reminder = {
            id: doc.id,
            ...data,
            targetDate: data.targetDate ? data.targetDate.toDate() : null,
            baseDate: data.baseDate ? data.baseDate.toDate() : null,
        };
        reminders.push(reminder);
    });
    
    return reminders;
}

/**
 * 通知が完了したリマインダーを更新する
 * @param {string} userId
 * @param {string} reminderId
 * @param {boolean} deactivate - 一回きりのリマインダーを無効にするか
 */
async function updateLastNotified(userId, reminderId, deactivate = false) {
    const db = getDb();
    const reminderRef = db.collection(USERS_COLLECTION).doc(userId)
                          .collection(REMINDERS_COLLECTION).doc(reminderId);
    
    const updateData = { lastNotifiedAt: FieldValue.serverTimestamp() };
    if (deactivate) { updateData.isActive = false; }

    await reminderRef.update(updateData);
}

module.exports = {
    saveReminder,
    getReminders,
    updateLastNotified,
};
