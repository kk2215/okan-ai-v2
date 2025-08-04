// templates/welcomeMessage.js - 最初の挨拶メッセージを作成

function createWelcomeMessage(displayName) {
    return {
        type: 'flex',
        altText: 'はじめまして！おかんAIよ。',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: `はじめまして、${displayName}ちゃん！`,
                        weight: 'bold',
                        size: 'lg',
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: 'これからあんたの毎日、おかんがしっかりサポートしたるからな！まずは、あんたのこと、色々教えてや。',
                        wrap: true,
                        size: 'md',
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
                            type: 'postback', // ★★★ ポストバックに変えるで！ ★★★
                            label: '初期設定をはじめる',
                            data: 'action=start_setup',
                            displayText: '初期設定をはじめる'
                        },
                        style: 'primary',
                        color: '#ff5722',
                        height: 'sm'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createWelcomeMessage
};
