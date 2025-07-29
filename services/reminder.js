// services/reminder.js - リマインダー情報のデータベース操作を担当

const { getDb, FieldValue } = require('./firestore');

const USERS_COLLECTION = 'users';
const REMINDERS_COLLECTION = 'reminders';

/**
 * 新しいリマインダーを保存する
 * @param {string} userId - LINEのユーザーID
 * @param {object} reminderData - { title, type, dayOfWeek } を含むリマインダーデータ
 */
async function saveReminder(userId, reminderData) {
    const db = getDb();
    const reminderRef = db.collection(USERS_COLLECTION).doc(userId)
                          .collection(REMINDERS_COLLECTION).doc(); // 自動IDで新規作成

    await reminderRef.set({
        ...reminderData,
        userId: userId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`リマインダーを保存しました: ${userId} -> ${reminderData.title}`);
}

/**
 * ユーザーのすべてのリマインダーを取得する
 * @param {string} userId - LINEのユーザーID
 * @returns {Promise<Array>} リマインダーの配列
 */
async function getReminders(userId) {
    const db = getDb();
    const snapshot = await db.collection(USERS_COLLECTION).doc(userId)
                             .collection(REMINDERS_COLLECTION)
                             .where('isActive', '==', true)
                             .get();
    
    if (snapshot.empty) {
        return [];
    }

    const reminders = [];
    snapshot.forEach(doc => {
        reminders.push({ id: doc.id, ...doc.data() });
    });
    
    return reminders;
}


module.exports = {
    saveReminder,
    getReminders,
};
