// templates/askGarbageDayMessage.js - ゴミの日設定を尋ねるメッセージを作成 (クイック返信版)

function createAskGarbageDayMessage() {
    return {
        text: '最後にゴミの日のお知らせ設定や。\nうっかり忘れへんように、収集日の朝に教えたろか？',
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '設定する',
                        text: 'ゴミの日を設定する'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: 'いらん',
                        text: 'ゴミの日は設定しない'
                    }
                }
            ]
        }
    };
}

module.exports = {
    createAskGarbageDayMessage
};
