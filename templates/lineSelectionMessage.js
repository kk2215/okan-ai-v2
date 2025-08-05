// templates/lineSelectionMessage.js - 路線を選択させるメッセージを作成

function createLineSelectionMessage(availableLines, selectedLines = []) {
    if (!availableLines || availableLines.length === 0) {
        return { type: 'text', text: 'ごめん、路線が見つからんかったわ。' };
    }

    const bubbles = [];
    for (let i = 0; i < availableLines.length; i += 5) {
        const chunk = availableLines.slice(i, i + 5);
        const buttons = chunk.map(line => {
            const isSelected = selectedLines.includes(line);
            const label = isSelected ? `✅ ${line}` : line;
            const style = isSelected ? 'primary' : 'secondary';
            const color = isSelected ? '#06c755' : undefined; // LINEの緑色や

            return {
                type: 'button',
                action: { 
                    type: 'postback', 
                    label: label, 
                    data: `action=add_line&line=${encodeURIComponent(line)}`, 
                    displayText: isSelected ? `「${line}」を取り消し` : `「${line}」を追加` 
                },
                style: style,
                color: color,
                margin: 'sm'
            };
        });
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
