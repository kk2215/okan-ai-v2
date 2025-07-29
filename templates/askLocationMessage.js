// templates/askLocationMessage.js

function createAskLocationMessage() {
    return {
        type: 'flex',
        altText: 'あんたのこと、教えてや！',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: 'まずは天気予報の設定からや！',
                        weight: 'bold',
                        size: 'lg',
                    },
                    {
                        type: 'text',
                        text: 'あんたが住んどる市町村を教えてくれるか？\n（例：東京都豊島区）',
                        wrap: true,
                        size: 'md',
                        margin: 'md',
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
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
    createAskLocationMessage
};