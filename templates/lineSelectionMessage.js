// templates/lineSelectionMessage.js - 路線を選択させるメッセージを作成

function createLineSelectionMessage(lines) {
    if (!lines || lines.length === 0) {
        return { type: 'text', text: 'ごめん、その駅を通る路線が見つからんかったわ。' };
    }

    // 路線ボタンのカルーセルを作成（1ページに6個ずつ）
    const bubbles = [];
    for (let i = 0; i < lines.length; i += 6) {
        const chunk = lines.slice(i, i + 6);
        const buttons = chunk.map(line => ({
            type: 'button',
            action: {
                type: 'postback',
                label: line,
                data: `action=add_line&line=${encodeURIComponent(line)}`,
                displayText: `「${line}」を追加`
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

    // 最後に「これで決定」ボタンを追加
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
                        data: 'action=confirm_line_selection'
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
            contents: [...bubbles, confirmBubble].slice(0, 12) // カルーセルは最大12個まで
        }
    };
}

module.exports = {
    createLineSelectionMessage
};
