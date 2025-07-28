const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Puppeteerがブラウザをダウンロード・保存する場所を変更します。
  // これにより、Renderのようなサーバー環境でもブラウザを見つけられるようになります。
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
