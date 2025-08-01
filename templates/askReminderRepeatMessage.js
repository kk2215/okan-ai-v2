// templates/askReminderRepeatMessage.js - リマインダーの繰り返しを尋ねるメッセージを作成

function createAskReminderRepeatMessage() {
    return {
        text: 'この予定、一回だけのことか？それとも毎週繰り返すんか？',
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        label: '一回だけ',
                        data: 'action=set_reminder_repeat&type=once',
                        displayText: '一回だけ'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        label: '毎週',
                        data: 'action=set_reminder_repeat&type=weekly',
                        displayText: '毎週'
                    }
                }
            ]
        }
    };
}

module.exports = {
    createAskReminderRepeatMessage
};
