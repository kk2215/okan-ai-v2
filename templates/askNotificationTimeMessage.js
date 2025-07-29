// templates/askNotificationTimeMessage.js - 通知時間を尋ねるメッセージを作成

function createAskNotificationTimeMessage() {
    return {
        type: 'flex',
        altText: '通知時間を教えてや！',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: '毎朝のお知らせ、何時に送ろか？',
                        weight: 'bold',
                        size: 'lg',
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: '下のボタンで選ぶか、「8:30」みたいに入力してくれてもええで。',
                        wrap: true,
                        size: 'md',
                        margin: 'md',
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
                            type: 'datetimepicker',
                            label: '時間をえらぶ',
                            data: 'action=set_notification_time',
                            mode: 'time',
                            initial: '07:00',
                            max: '10:00',
                            min: '05:00'
                        },
                        style: 'primary',
                        color: '#ff5722',
                    }
                ]
            }
        }
    };
}

module.exports = {
    createAskNotificationTimeMessage
};
