// templates/confirmReminderMessage.js - リマインダー内容の最終確認メッセージを作成

// 日本の曜日の名前
const dayOfWeekMap = ['(日)', '(月)', '(火)', '(水)', '(木)', '(金)', '(土)'];

function createConfirmReminderMessage(reminderData) {
    const { title, type, notificationTime, dayOfWeek, targetDate } = reminderData;

    let whenText = '';
    if (type === 'weekly') {
        const dayOfWeekJpMap = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
        whenText = `毎週${dayOfWeekJpMap[dayOfWeek]}の${notificationTime}頃`;
    } else if (type === 'once') {
        const date = new Date(targetDate);
        // 日本の時間として表示するためのオプション
        const options = { 
            timeZone: 'Asia/Tokyo', 
            year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', hour12: false 
        };
        const formattedDate = new Intl.DateTimeFormat('ja-JP', options).format(date);
        const day = dayOfWeekMap[date.getDay()];
        whenText = `${formattedDate} ${day}`;
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
