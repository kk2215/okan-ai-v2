// templates/lineSelectionMessage.js - 路線を選択させるメッセージを作成

function createLineSelectionMessage(lines) {
    if (!lines || lines.length === 0) {
        return { type: 'text', text: 'ごめん、その駅を通る路線が見つからんかったわ。' };
    }

    const bubbles = [];
    for (let i = 0; i < lines.length; i += 6) {
        const chunk = lines.slice(i, i + 6);
        const buttons = chunk.map(line => ({
            type: 'button',
            action: {
                type: 'postback',
                label: line,
                data: `action=add_line&line=${encodeURIComponent(line)}`,
                displayText: `「${line}」を追加` // ★★★ ハンコ ★★★
            },
            style: 'secondary',
            margin: 'sm'
        }));
        
        bubbles.push({
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: buttons
            }
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
                        label: 'これで決定！',
                        data: 'action=confirm_line_selection',
                        displayText: 'これで決定！' // ★★★ ハンコ ★★★
                    },
                    style: 'primary',
                    color: '#ff5722',
                    height: 'sm'
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
