// services/richMenu.js - リッチメニューを管理する専門家

const { getClient } = require('./lineClient');

// リッチメニューのデザイン
const richMenu = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "Okan AI Menu",
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
        // 1. 今あるメニューを全部削除して、きれいにしとく
        const existingMenus = await client.getRichMenuList();
        for (const menu of existingMenus) {
            await client.deleteRichMenu(menu.richMenuId);
        }
        console.log('古いリッチメニューを掃除したで。');

        // 2. 新しいメニューのデザインを登録
        const richMenuId = await client.createRichMenu(richMenu);
        console.log(`新しいリッチメニューID: ${richMenuId}`);

        // 3. メニューに画像をセット（今回はLINEが用意してくれてるサンプル画像を使う）
        // ※ほんまは、あんたが作った画像をアップロードするんやで！
        const imageResponse = await client.getRichMenuImage('DEFAULT_RICH_MENU_IMAGE'); // 仮の画像
        await client.setRichMenuImage(richMenuId, imageResponse.data);
        
        // 4. このメニューを、これからの標準メニューにする
        await client.setDefaultRichMenu(richMenuId);

        console.log('🎉 新しいリッチメニューの準備ができたで！');

    } catch (error) {
        console.error('リッチメニューの準備でエラーが出てもうたわ…:', error.originalError ? error.originalError.response.data : error);
    }
}

module.exports = {
    setupRichMenu,
};
