// templates/setupCompleteMessage.js - 設定完了メッセージを作成

function createSetupCompleteMessage(displayName) {
    return {
        type: 'flex',
        altText: '設定おおきに！',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'lg',
                contents: [
                    {
                        type: 'text',
                        text: '設定、お疲れさん！',
                        weight: 'bold',
                        size: 'xl',
                        align: 'center',
                    },
                    {
                        type: 'text',
                        text: `これで毎朝あんたのために、天気とか色々見てあげるからな、${displayName}ちゃん！`,
                        wrap: true,
                        size: 'md',
                    },
                    {
                        type: 'text',
                        text: '何かあったら、いつでも話しかけてや〜👋',
                        wrap: true,
                        size: 'md',
                    }
                ]
            }
        }
    };
}

module.exports = {
    createSetupCompleteMessage
};
