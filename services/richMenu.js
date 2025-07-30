// services/richMenu.js - リッチメニューを管理する専門家

const { getClient } = require('./lineClient');
const fs = require('fs');
const path = require('path');

// リッチメニューのデザイン
const richMenu = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "Okan AI Menu v1",
    chatBarText: "おかんメニュー",
    areas: [
        {
            bounds: { x: 0, y: 0, width: 1250, height: 843 },
            action: {
                type: 'postback',
                data: 'action=new_reminder',
                displayText: '新しい予定を教える'
            }
        },
        {
            bounds: { x: 1251, y: 0, width: 1250, height: 843 },
            action: {
                type: 'postback',
                data: 'action=list_reminders',
                displayText: '登録した予定を見る'
            }
        }
    ]
};

/**
 * リッチメニューを作成し、全ユーザーに適用する
 */
async function setupRichMenu() {
    const client = getClient();
    try {
        const imagePath = path.join(__dirname, '..', 'richmenu.png');
        if (!fs.existsSync(imagePath)) {
            console.warn('リッチメニューの画像 `richmenu.png` が見つからへんで！画像なしで進めるわな。');
            return;
        }

        const existingMenus = await client.getRichMenuList();
        for (const menu of existingMenus) {
            await client.deleteRichMenu(menu.richMenuId);
        }
        console.log('古いリッチメニューを掃除したで。');

        const richMenuId = await client.createRichMenu(richMenu);
        console.log(`新しいリッチメニューID: ${richMenuId}`);

        const imageBuffer = fs.readFileSync(imagePath);
        await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
        
        await client.setDefaultRichMenu(richMenuId);

        console.log('🎉 新しいリッチメニューの準備ができたで！');

    } catch (error) {
        console.error('リッチメニューの準備でエラーが出てもうたわ…:', error.originalError ? error.originalError.response.data : error);
    }
}

module.exports = {
    setupRichMenu,
};
