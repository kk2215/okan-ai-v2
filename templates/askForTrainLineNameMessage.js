// templates/askForTrainLineNameMessage.js - 路線名を尋ねるメッセージを作成

function createAskForTrainLineNameMessage() {
    return {
        type: 'text',
        text: 'いつも乗る路線名を教えてや。\n複数ある場合は「、」で区切ってな。\n（例：JR山手線、東京メトロ丸ノ内線）\n\nいらんかったら「なし」って言うてな。',
    };
}

module.exports = {
    createAskForTrainLineNameMessage
};
