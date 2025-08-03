// templates/trainSelectionMessages.js - 路線選択ボタンの設計図

// おかんが知ってる日本全国の主な路線リスト
const trainData = {
    '北海道': {
        'JR北海道': ['函館本線', '千歳線', '室蘭本線', '根室本線', '石勝線', '富良野線']
    },
    '東北': {
        'JR東日本': ['東北本線', '奥羽本線', '羽越本線', '仙山線', '仙石線', '常磐線']
    },
    '関東': {
        'JR東日本': ['山手線', '京浜東北線', '中央線', '総武線', '埼京線', '湘南新宿ライン', '常磐線', '京葉線', '横浜線', '南武線', '武蔵野線'],
        '東京メトロ': ['銀座線', '丸ノ内線', '日比谷線', '東西線', '千代田線', '有楽町線', '半蔵門線', '南北線', '副都心線'],
        '都営地下鉄': ['浅草線', '三田線', '新宿線', '大江戸線'],
        '東急電鉄': ['東横線', '目黒線', '田園都市線', '大井町線', '池上線', '東急多摩川線', '世田谷線'],
        '京王電鉄': ['京王線', '井の頭線'],
        '小田急電鉄': ['小田原線', '江ノ島線', '多摩線'],
        '西武鉄道': ['池袋線', '新宿線'],
        '東武鉄道': ['東上線', 'スカイツリーライン'],
        '京成電鉄': ['本線'],
        '京急電鉄': ['本線']
    },
    '中部': {
        'JR東海': ['東海道本線', '中央本線'],
        '名古屋鉄道': ['名古屋本線', '犬山線', '常滑線']
    },
    '近畿': {
        'JR西日本': ['大阪環状線', '東海道本線', '山陽本線', '阪和線', '関西本線'],
        '近畿日本鉄道': ['奈良線', '大阪線', '京都線'],
        '阪急電鉄': ['神戸線', '宝塚線', '京都線'],
        '阪神電気鉄道': ['本線'],
        '京阪電気鉄道': ['京阪本線'],
        '南海電気鉄道': ['南海本線', '高野線']
    },
    '中国・四国': {
        'JR西日本': ['山陽本線', '宇野線', '予讃線', '土讃線']
    },
    '九州': {
        'JR九州': ['鹿児島本線', '長崎本線', '日豊本線'],
        '西日本鉄道': ['天神大牟田線']
    }
};

/**
 * 地域を選択させるメッセージを作成
 */
function createRegionSelectionMessage() {
    const regions = Object.keys(trainData);
    const buttons = regions.map(region => ({
        type: 'button',
        action: { type: 'postback', label: region, data: `action=select_region&region=${region}`, displayText: `${region}を選ぶ` },
        style: 'secondary',
        margin: 'sm'
    }));

    return {
        type: 'flex',
        altText: 'どの地域に住んどる？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: 'まず、あんたが住んどる地域を教えてな。', wrap: true }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: buttons
            }
        }
    };
}

/**
 * 鉄道会社を選択させるメッセージを作成
 * @param {string} region - 選択された地域
 */
function createCompanySelectionMessage(region) {
    const companies = Object.keys(trainData[region]);
    const buttons = companies.map(company => ({
        type: 'button',
        action: { type: 'postback', label: company, data: `action=select_company&company=${encodeURIComponent(company)}`, displayText: `${company}を選ぶ` },
        style: 'secondary',
        margin: 'sm'
    }));

    return {
        type: 'flex',
        altText: 'どの鉄道会社を使う？',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: `「${region}」やね。ほな、次は鉄道会社を教えてな。`, wrap: true }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: buttons
            }
        }
    };
}

/**
 * 路線を選択させるメッセージを作成
 * @param {string} region
 * @param {string} company
 */
function createLineSelectionMessage(region, company) {
    const lines = trainData[region][company];
    const bubbles = [];
    for (let i = 0; i < lines.length; i += 5) {
        const chunk = lines.slice(i, i + 5);
        const buttons = chunk.map(line => ({
            type: 'button',
            action: { type: 'postback', label: line, data: `action=add_line&line=${encodeURIComponent(line)}`, displayText: `「${line}」を追加/取り消し` },
            style: 'secondary',
            margin: 'sm'
        }));
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
                    action: { type: 'postback', label: 'これで決定！', data: 'action=confirm_line_selection', displayText: '路線を決定する' },
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
    createRegionSelectionMessage,
    createCompanySelectionMessage,
    createLineSelectionMessage,
};
