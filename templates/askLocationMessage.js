// templates/askLocationMessage.js - 地域を尋ねるメッセージを作成 (必須化対応版)

function createAskLocationMessage() {
    return {
        type: 'text',
        text: 'まずは天気予報の設定からや！\nあんたが住んどる市町村名を教えてくれるか？\n（例：豊島区、横浜市中区）',
    };
}

module.exports = {
    createAskLocationMessage
};
