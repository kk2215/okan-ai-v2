// templates/confirmReminderMessage.js - リマインダー内容の最終確認メッセージを作成

// 日本の曜日の名前
const dayOfWeekMap = ['(日)', '(月)', '(火)', '(水)', '(木)', '(金)', '(土)'];

function createConfirmReminderMessage(remindersData) {
    const dayOfWeekJpMap = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
    
    const summary = remindersData.map(r => {
        let whenText = '';
        if (r.type === 'weekly') {
            const time = r.notificationTime ? `の${r.notificationTime}頃` : 'の朝';
            whenText = `毎週${dayOfWeekJpMap[r.dayOfWeek]}${time}`;
        } else if (r.type === 'once') {
            const date = new Date(r.targetDate);
            const options = { 
                timeZone: 'Asia/Tokyo', 
                year: 'numeric', month: 'numeric', day: 'numeric', 
                weekday: 'short',
                hour: '2-digit', minute: '2-digit', hour12: false 
            };
            whenText = new Intl.DateTimeFormat('ja-JP', options).format(date);
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
