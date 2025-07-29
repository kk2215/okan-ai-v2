    // templates/askNotificationTimeMessage.js - 通知時間を尋ねるメッセージを作成

    function createAskNotificationTimeMessage() {
        return {
            type: 'flex',
            altText: '通知時間を教えてちょうだい！',
            contents: {
                type: 'bubble',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: '毎朝何時に起こしてほしい？',
                            weight: 'bold',
                            size: 'lg',
                        },
                        {
                            type: 'text',
                            text: '下のボタンで選ぶか、「8:30」のように入力してね。',
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
                                data: 'action=set_notification_time', // ボタンが押されたことを識別するデータ
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
    