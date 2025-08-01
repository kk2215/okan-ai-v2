// test.js - Renderの環境で、ちゃんと道具が使えるかだけを調べるテスト

try {
    console.log('テスト開始や！今から新しい頭脳を呼んでくるで…');
    
    // たった一行、この道具を呼べるかどうかだけを試す
    require('@google-cloud/dialogflow');
    
    // もし、この下の行がログに出たら、私らの勝ちや！
    console.log('🎉🎉🎉 よっしゃ！新しい頭脳、ちゃんと厨房におったで！ 🎉🎉🎉');
    
} catch (error) {
    // もし、まだエラーが出るんやったら、原因はコードやない。Renderの環境そのものや。
    console.error('🔥🔥🔥 アカン！やっぱり厨房に新しい頭脳がおらへん！ 🔥🔥🔥');
    console.error(error);
    process.exit(1); // エラーで終了
}
