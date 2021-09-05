# FlMML on HTML5

[![npm version](https://badge.fury.io/js/flmml-on-html5.svg)](https://badge.fury.io/js/flmml-on-html5)
[![Join the chat at https://gitter.im/argentum384/flmml-on-html5](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/argentum384/flmml-on-html5?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The porting of [FlMML](https://flmml.codeplex.com/), MML player which runs on Flash Player, to HTML5\.

---
Flash上でMMLを演奏する[FlMML](https://flmml.codeplex.com/)をHTML5環境上に移植したものです。

デモはこちら  
[Demo page](https://argentum384.github.io/flmml-on-html5-demo/)

**※v1.x 系で付属していたプレイヤーUIは v2.0.0 で削除されました**

## 対応ブラウザ
* 動作確認済み
    * Chrome
    * Chrome for Android
    * FireFox
    * Opera
    * Safari
    * iOS Safari
    * Microsoft Edge
    * Android Browser \(Android 5.x 以降\)
* 非対応確認済み
    * Internet Explorer
    * Android Browser \(Android 4.x 以前\)
    * Opera Mini

## 使い方
シーケンサの詳細な仕様は[wiki](https://github.com/argentum384/flmml-on-html5/wiki)をご覧下さい。  

### js ファイルを直接読み込む
1. [Releases](https://github.com/argentum384/flmml-on-html5/releases) から `flmml-on-html5.js` , `flmml-on-html5.worker.js` のそれぞれをダウンロード
1. `flmml-on-html5.js` のみ `<script>` タグで読み込む
1. **再生開始の契機となるイベント発火の前に**クリックされるボタン/プレイヤー等 DOM 要素の CSS セレクタを `FlMML.prepare(playerSelector)` の引数に指定し実行する  
   ※実行しなくとも問題ない場合もありますが実行することを推奨します。詳細は [wiki](https://github.com/argentum384/flmml-on-html5/wiki/v2.x#prepare) を参照
1. `new FlMML()` の引数に `flmml-on-html5.worker.js` のパスを指定  
   ※ `flmml-on-html5.worker.js` をサイトと異なるドメインに配置した場合は `crossOriginWorker` オプションを有効にして下さい。詳細は [wiki](https://github.com/argentum384/flmml-on-html5/wiki/v2.x#constructor) を参照

例:  
ディレクトリ構成
```
somedir
├js
│├flmml-on-html5.js
│└flmml-on-html5.worker.js
└index.html
```
index.html
```html
...
<script src="./js/flmml-on-html5.js"></script>
<script>
    FlMML.prepare("#play");
    const flmml = new FlMML({ workerURL: "./js/flmml-on-html5.worker.js" });
    function onClick() {
        flmml.play("L8 O5CDEFGAB<C");
    }
</script>
...
<button id="play" onclick="onClick()">Play</button>
...
```

### npm パッケージをインストール
1. インストール  
   npm の場合:  
   ```
   npm i -D flmml-on-html5
   ```
   yarn の場合:  
   ```
   yarn add -D flmml-on-html5
   ```
1. インストール後 `./node_modules/flmml-on-html5/dist/flmml-on-html5.worker.js` をお好みの場所にコピー
1. **再生開始の契機となるイベント発火の前に**クリックされるボタン/プレイヤー等 DOM 要素の CSS セレクタを `FlMML.prepare(playerSelector)` の引数に指定し実行する  
1. `new FlMML()` の引数にコピーした `flmml-on-html5.worker.js` のパスを指定

例:
```js
import { FlMML } from "flmml-on-html5";
...
FlMML.prepare(somePlayerSelectors);
const flmml = new FlMML({ workerURL: someWorkerURL });
...
```


## For Developers

### 開発環境構築
- Node.js, yarn 導入済の環境で
- `git clone` 後リポジトリのルートディレクトリに移動し
```
yarn install
yarn start
```

## 謝辞
[FlMML](https://flmml.codeplex.com/)作者のおー氏をはじめとしたFlMMLのコミッターの皆様、ならびに FlMML on HTML5 の不具合を報告頂いたユーザーの皆様、そのほか FlMML \/ FlMML on HTML5 の発展に関わるすべての方々に感謝します。
