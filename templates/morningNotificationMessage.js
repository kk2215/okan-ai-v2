// templates/morningNotificationMessage.js - 毎朝の通知メッセージをデザインする

/**
 * 朝の通知用Flex Messageを作成する
 * @param {object} data - { user, weatherInfo, trainInfo, garbageInfo } を含むデータ
 * @returns {object} LINE Flex Messageオブジェクト
 */
function createMorningMessage(data) {
    const { user, weatherInfo, trainInfo, garbageInfo } = data;

    const contents = [];

    // --- 天気セクション ---
    if (weatherInfo) {
        contents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
                {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                        { type: 'text', text: '今日の天気', color: '#aaaaaa', size: 'sm', flex: 3 },
                        { type: 'text', text: `${weatherInfo.description}、最高${weatherInfo.temp_max}℃ / 最低${weatherInfo.temp_min}℃やで。`, color: '#666666', size: 'sm', flex: 5, wrap: true }
                    ]
                }
            ]
        });
    }

    // --- 電車セクション ---
    if (trainInfo && trainInfo.length > 0) {
        contents.push({ type: 'separator', margin: 'lg' });
        const trainContents = trainInfo.map(info => ({
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
                { type: 'text', text: info.lineName, color: '#aaaaaa', size: 'sm', flex: 3, wrap: true },
                { type: 'text', text: info.status, color: info.status.includes('平常') ? '#666666' : '#ff5722', size: 'sm', flex: 5, wrap: true }
            ]
        }));
        
        contents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: trainContents
        });
    }

    // --- ゴミの日セクション ---
    if (garbageInfo && garbageInfo.length > 0) {
        contents.push({ type: 'separator', margin: 'lg' });
        const garbageText = garbageInfo.map(g => g.title).join('と');
        contents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
                {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                        { type: 'text', text: 'ゴミの日', color: '#aaaaaa', size: 'sm', flex: 3 },
                        { type: 'text', text: `今日は「${garbageText}」の日やで！忘れんといてな！`, color: '#666666', size: 'sm', flex: 5, wrap: true }
                    ]
                }
            ]
        });
    }

    return {
        type: 'flex',
        altText: 'おかんから朝のお知らせやで〜',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `${user.displayName}ちゃん、朝やで！`,
                        weight: 'bold',
                        size: 'xl'
                    },
                    ...contents
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            { type: 'text', text: '今日も一日、頑張りや！いってらっしゃい！', wrap: true, size: 'md', margin: 'md' }
                        ],
                        paddingAll: 'md'
                    }
                ]
            }
        }
    };
}

module.exports = {
    createMorningMessage
};
