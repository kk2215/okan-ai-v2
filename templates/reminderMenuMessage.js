// templates/reminderMenuMessage.js - リマインダーの操作メニューを作成

function createReminderMenuMessage() {
    return {
        type: 'flex',
        altText: 'リマインダー、どうする？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: 'リマインダーやな。どないする？',
                        weight: 'bold',
                        size: 'lg',
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: '新しい予定を教える',
                            data: 'action=new_reminder'
                        },
                        style: 'primary',
                        color: '#ff5722'
                    },
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: '登録した予定を見る',
                            data: 'action=list_reminders'
                        },
                        style: 'secondary'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createReminderMenuMessage
};
