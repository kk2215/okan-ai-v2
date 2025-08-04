// templates/lineSelectionMessage.js - 路線を選択させるメッセージを作成

function createLineSelectionMessage(lines) {
    if (!lines || lines.length === 0) {
        return { type: 'text', text: 'ごめん、路線が見つからんかったわ。' };
    }

    const bubbles = [];
    for (let i = 0; i < lines.length; i += 5) {
        const chunk = lines.slice(i, i + 5);
        const buttons = chunk.map(line => ({
            type: 'button',
            action: { type: 'postback', label: line, data: `action=add_line&line=${encodeURIComponent(line)}`, displayText: `「${line}」を追加/取り消し` },
            style: 'secondary',
            margin: 'sm'
        }));
        bubbles.push({
            type: 'bubble',
            body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons }
        });
    }

    const confirmBubble = {
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'postback',
                        label: '乗り換え駅を追加',
                        data: 'action=add_transfer_station',
                        displayText: '乗り換え駅を追加する'
                    },
                    style: 'secondary',
                    height: 'sm',
                    margin: 'md'
                },
                {
                    type: 'button',
                    action: {
                        type: 'postback',
                        label: 'これで決定！',
                        data: 'action=confirm_line_selection',
                        displayText: '路線を決定する'
                    },
                    style: 'primary',
                    color: '#ff5722',
                    height: 'sm',
                    margin: 'md'
                }
            ]
        }
    };

    return {
        type: 'flex',
        altText: 'どの路線を使う？',
        contents: {
            type: 'carousel',
            contents: [...bubbles, confirmBubble].slice(0, 12)
        }
    };
}

module.exports = {
    createLineSelectionMessage
};
