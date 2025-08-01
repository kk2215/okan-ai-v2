// templates/askReminderDateTimeMessage.js - リマインダーの日時を尋ねるメッセージを作成

function createAskReminderDateTimeMessage() {
    return {
        type: 'flex',
        altText: 'いつ教えたらええ？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'datetimepicker',
                            label: '日時をえらぶ',
                            data: 'action=set_reminder_datetime',
                            mode: 'datetime', // 日付と時間の両方
                        },
                        style: 'primary',
                        color: '#ff5722'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createAskReminderDateTimeMessage
};
