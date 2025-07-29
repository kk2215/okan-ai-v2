// templates/askTrainLineMessage.js - 電車設定を尋ねるメッセージを作成

function createAskTrainLineMessage() {
    return {
        type: 'flex',
        altText: '電車の情報、いる？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: '次は電車の運行情報の設定や。',
                        weight: 'bold',
                        size: 'lg',
                    },
                    {
                        type: 'text',
                        text: '朝の通知と一緒に、いつも乗る電車の遅れとかも教えたろか？',
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
                            text: '電車の設定する'
                        },
                        style: 'primary',
                        color: '#ff5722',
                    },
                    {
                        type: 'button',
                        action: {
                            type: 'message',
                            label: '設定せえへん',
                            text: 'なし'
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
    createAskTrainLineMessage
};
