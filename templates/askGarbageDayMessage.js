// templates/askGarbageDayMessage.js - ゴミの日設定を尋ねるメッセージを作成

function createAskGarbageDayMessage() {
    return {
        type: 'flex',
        altText: 'ゴミの日、設定する？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: '最後にゴミの日のお知らせ設定や。',
                        weight: 'bold',
                        size: 'lg',
                    },
                    {
                        type: 'text',
                        text: 'うっかり忘れへんように、収集日の朝に教えたろか？',
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
                            type: 'message',
                            label: '設定する',
                            text: 'ゴミの日を設定する'
                        },
                        style: 'primary',
                        color: '#ff5722',
                    },
                    {
                        type: 'button',
                        action: {
                            type: 'message',
                            label: '設定せえへん',
                            text: 'ゴミの日は設定しない'
                        },
                        style: 'secondary',
                        height: 'sm'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createAskGarbageDayMessage
};
