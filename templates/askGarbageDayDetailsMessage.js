// templates/askGarbageDayDetailsMessage.js - ゴミの日の詳細を尋ねるメッセージを作成

function createAskGarbageDayDetailsMessage() {
    return {
        type: 'text',
        text: 'ほな、設定したいゴミの種類と曜日を教えてや。\n「、」かスペースで区切ってな。\n（例：燃えるゴミ、火曜日）\n\n他にもあったら、続けて入力してくれてええで。終わったら「終わり」って言うてな。',
    };
}

module.exports = {
    createAskGarbageDayDetailsMessage
};
