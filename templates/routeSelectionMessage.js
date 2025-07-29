// templates/routeSelectionMessage.js - 経路の選択肢を提示するメッセージを作成

function createRouteSelectionMessage(routes) {
    if (!routes || routes.length === 0) {
        return { type: 'text', text: 'ごめん、経路が見つからんかったわ。' };
    }

    const bubbles = routes.slice(0, 10).map(route => ({ // 最大10件まで
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
                { type: 'text', text: `所要時間：約${route.time}分`, weight: 'bold', size: 'lg' },
                { type: 'text', text: `乗り換え：${route.transfers}回`, size: 'md' },
                { type: 'text', text: `主な路線：${route.lines.slice(0, 2).join('、')}など`, size: 'sm', wrap: true, margin: 'md' },
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'postback',
                        label: 'この経路にする',
                        data: `action=select_route&index=${route.index}`
                    },
                    style: 'primary',
                    color: '#ff5722'
                }
            ]
        }
    }));

    return {
        type: 'flex',
        altText: 'どの経路で行く？',
        contents: {
            type: 'carousel',
            contents: bubbles
        }
    };
}

module.exports = {
    createRouteSelectionMessage
};
