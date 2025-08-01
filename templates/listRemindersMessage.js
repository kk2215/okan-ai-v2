// templates/listRemindersMessage.js - 登録済みのリマインダー一覧を作成

function createListRemindersMessage(reminders) {
    const dayOfWeekMap = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];

    const bubbles = reminders.slice(0, 12).map(reminder => {
        let whenText = '';
        if (reminder.type === 'weekly') {
            if (!reminder.notificationTime) {
                whenText = `毎週${dayOfWeekMap[reminder.dayOfWeek]}の朝`;
            } else {
                whenText = `毎週${dayOfWeekMap[reminder.dayOfWeek]}の${reminder.notificationTime}頃`;
            }
        } else if (reminder.type === 'once') {
            const date = new Date(reminder.targetDate);
            const options = { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
            whenText = new Intl.DateTimeFormat('ja-JP', options).format(date);
        }

        return {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: reminder.title, weight: 'bold', size: 'lg', wrap: true },
                    { type: 'text', text: whenText, size: 'md', color: '#666666' },
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: '削除する',
                            data: `action=delete_reminder&id=${reminder.id}`,
                            displayText: `「${reminder.title}」の予定を削除`
                        },
                        style: 'secondary',
                        height: 'sm'
                    }
                ]
            }
        };
    });

    return {
        type: 'flex',
        altText: '登録されとる予定の一覧やで',
        contents: {
            type: 'carousel',
            contents: bubbles
        }
    };
}

module.exports = {
    createListRemindersMessage
};
