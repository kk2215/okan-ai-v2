// templates/askTrainLineMessage.js - 電車設定を尋ねるメッセージを作成 (クイック返信版)

function createAskTrainLineMessage() {
    return {
        type: 'text', // この一行を追加するんや！
        text: '次は電車の運行情報の設定や。\n朝の通知と一緒に、いつも乗る電車の遅れとかも教えたろか？',
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '設定する',
                        text: '電車の設定する'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: 'いらん',
                        text: 'なし'
                    }
                }
            ]
        }
    };
}

module.exports = {
    createAskTrainLineMessage
};
