// templates/confirmReminderMessage.js - リマインダー内容の最終確認メッセージを作成

const dateFnsTz = require('date-fns-tz'); // 正しい時計の呼び出し方

function createConfirmReminderMessage(remindersData) {
    const dayOfWeekMap = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
    
    const summary = remindersData.map(r => {
        let whenText = '';
        if (r.type === 'weekly') {
            const time = r.notificationTime ? `の${r.notificationTime}頃` : 'の朝';
            whenText = `毎週${dayOfWeekMap[r.dayOfWeek]}${time}`;
        } else if (r.type === 'once') {
            whenText = dateFnsTz.formatInTimeZone(new Date(r.targetDate), 'Asia/Tokyo', 'M月d日(E) HH:mm');
        }
        return `・${r.title} (${whenText})`;
    }).join('\n');

    const confirmText = `下の予定で登録するで。ええか？\n\n${summary}`;

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
                        action: { type: 'postback', label: 'それでええで！', data: 'action=confirm_reminder', displayText: 'それでええで！' },
                        style: 'primary',
                        color: '#ff5722'
                    },
                    {
                        type: 'button',
                        action: { type: 'postback', label: 'やっぱやめる', data: 'action=cancel_reminder', displayText: 'やっぱやめる' },
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
