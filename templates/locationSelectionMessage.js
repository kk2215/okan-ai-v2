// templates/locationSelectionMessage.js - 地域の候補を選択させるメッセージを作成

function createLocationSelectionMessage(locations) {
    const bubbles = locations.slice(0, 12).map((location, index) => ({ // 最大12件まで
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
                {
                    type: 'text',
                    text: location.formattedAddress,
                    wrap: true,
                    weight: 'bold'
                },
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
                        label: 'ここにする',
                        data: `action=select_location&index=${index}`
                    },
                    style: 'primary',
                    color: '#ff5722'
                }
            ]
        }
    }));

    return {
        type: 'flex',
        altText: '場所はここでええか？',
        contents: {
            type: 'carousel',
            contents: bubbles
        }
    };
}

module.exports = {
    createLocationSelectionMessage
};
