// templates/confirmReminderMessage.js - リマインダー内容の最終確認メッセージを作成

const { format } = require('date-fns-tz');

function createConfirmReminderMessage(reminderData) {
    const { title, type, notificationTime, dayOfWeek, targetDate } = reminderData;
    const dayOfWeekMap = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];

    let whenText = '';
    if (type === 'weekly') {
        whenText = `毎週${dayOfWeekMap[dayOfWeek]}の${notificationTime}頃`;
    } else if (type === 'once') {
        const date = new Date(targetDate);
        whenText = format(date, 'M月d日(E) HH:mm', { timeZone: 'Asia/Tokyo' });
    }

    const confirmText = `「${title}」やな。\n${whenText}に教えたらええんか？`;

    return {
        type: 'flex',
        altText: 'この内容でええか？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: '確認やで', weight: 'bold', size: 'lg' },
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: confirmText, wrap: true, margin: 'md' },
                ]
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        action: { type: 'postback', label: 'それでええで！', data: 'action=confirm_reminder' },
                        style: 'primary',
                        color: '#ff5722'
                    },
                    {
                        type: 'button',
                        action: { type: 'postback', label: 'やっぱやめる', data: 'action=cancel_reminder' },
                        style: 'secondary'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createConfirmReminderMessage
};
