    // templates/welcomeMessage.js - 最初の挨拶メッセージを作成

    function createWelcomeMessage(displayName) {
        return {
            type: 'text',
            text: `はじめまして、${displayName}ちゃん！\nこれからあんたの毎日、おかんがしっかりサポートしたるからな！\nさっそくやけど、いくつか設定させてや👵`,
        };
    }

    module.exports = {
        createWelcomeMessage
    };
    