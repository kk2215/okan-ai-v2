// templates/askStationsMessage.js - 乗車駅と降車駅を尋ねるメッセージを作成

function createAskStationsMessage() {
    return {
        type: 'text',
        text: 'ほな、いつも乗る駅と降りる駅を教えてくれるか？\n「〇〇から〇〇まで」って言うてな。\n（例：池袋から新宿まで）',
    };
}

module.exports = {
    createAskStationsMessage
};
