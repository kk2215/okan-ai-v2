// templates/trainLineConfirmationMessage.js - 登録する路線一覧の最終確認メッセージを作成

function createTrainLineConfirmationMessage(lines) {
    const lineList = lines.map(line => `・${line}`).join('\n');

    return {
        type: 'flex',
        altText: 'この路線でええか？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: 'ほな、下の路線を登録するで。', wrap: true },
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: lineList, wrap: true, margin: 'md' },
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: 'これでええか？', wrap: true },
                ]
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        action: { type: 'postback', label: 'OK', data: 'action=confirm_train_lines' },
                        style: 'primary',
                        color: '#ff5722'
                    },
                    {
                        type: 'button',
                        action: { type: 'postback', label: 'やめる', data: 'action=cancel_train_lines' },
                        style: 'secondary'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createTrainLineConfirmationMessage
};
