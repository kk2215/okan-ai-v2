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
                        text: 'ほな、それは何曜日や？下のボタンで教えてな。複数ある場合は、ぜんぶ押しといてな！',
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
                            action: { type: 'postback', label: d.label, data: `action=set_garbage_day&day=${d.day}`, displayText: `${garbageType}は${d.label}` },
                            style: 'secondary'
                        }))
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        spacing: 'sm',
                        contents: days.slice(4, 7).map(d => ({
                            type: 'button',
                            action: { type: 'postback', label: d.label, data: `action=set_garbage_day&day=${d.day}`, displayText: `${garbageType}は${d.label}` },
                            style: 'secondary'
                        }))
                    }
                ]
            }
        }
    };
}

module.exports = {
    createAskGarbageDayOfWeekMessage
};
