// templates/askGarbageDayOfWeekMessage.js - ゴミの日の曜日を選択させるメッセージを作成

function createAskGarbageDayOfWeekMessage(garbageType) {
    const days = [
        { label: '月曜', day: 1 }, { label: '火曜', day: 2 }, { label: '水曜', day: 3 },
        { label: '木曜', day: 4 }, { label: '金曜', day: 5 }, { label: '土曜', day: 6 },
        { label: '日曜', day: 0 }
    ];

    return {
        type: 'flex',
        altText: `「${garbageType}」は何曜日？`,
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: `「${garbageType}」やね。`,
                        weight: 'bold',
                        size: 'lg'
                    },
                    {
                        type: 'text',
                        text: '収集日を下のボタンで全部教えてな。押し終わったら「これで決定」やで。',
                        wrap: true
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        spacing: 'sm',
                        contents: days.slice(0, 4).map(d => ({
                            type: 'button',
                            action: { type: 'postback', label: d.label, data: `action=set_garbage_day&day=${d.day}`, displayText: `${garbageType}に${d.label}を追加` },
                            style: 'secondary'
                        }))
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        spacing: 'sm',
                        contents: days.slice(4, 7).map(d => ({
                            type: 'button',
                            action: { type: 'postback', label: d.label, data: `action=set_garbage_day&day=${d.day}`, displayText: `${garbageType}に${d.label}を追加` },
                            style: 'secondary'
                        }))
                    },
                    {
                        type: 'separator',
                        margin: 'md'
                    },
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: 'これで決定',
                            data: 'action=confirm_garbage_days',
                            displayText: 'ゴミの日の曜日を決定する'
                        },
                        style: 'primary',
                        color: '#ff5722',
                        margin: 'md'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createAskGarbageDayOfWeekMessage
};
