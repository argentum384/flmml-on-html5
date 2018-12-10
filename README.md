# FlMML on HTML5

[![Join the chat at https://gitter.im/argentum384/flmml-on-html5](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/argentum384/flmml-on-html5?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)  
The porting of [FlMML](https://flmml.codeplex.com/), MML player which runs on Flash Player, to HTML5\.

---
Flash上でMMLを演奏する[FlMML](https://flmml.codeplex.com/)をHTML5環境上に移植したものです。  
SVGを使用したプレイヤーUIも付属しています。  
![screenshot.gif](http://argentum384.github.io/flmml-on-html5/screenshot.gif "Screen Shot")  

デモはこちら  
[Demo page](http://argentum384.github.io/flmml-on-html5/)

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

## Webページに貼り付ける
ここではMMLが記述されたファイルを`mml.txt`として話を進めます。  
HTMLファイルと同じディレクトリに
```
flmmlonhtml5.js
flmmlworker.js
flmmlplayer.js
mml.txt
```
のように、3つのスクリプトとMMLが記述されたファイル\(拡張子は何でも可\)を置きます。  
HTMLファイルの`<head>`タグ内に
```html
...
<head>
    ...
    <script type="text/javascript" src="flmmlonhtml5.js"></script>
    <script type="text/javascript" src="flmmlplayer.js"></script>
    ...
</head>
...
```
の__2行__\(`flmmlworker.js`は読み込まない\)を加え、プレイヤーを配置したいところに以下のように記述します。
```html
...
<body>
    ...
    <script type="text/javascript">
        new FlMMLPlayer({ mmlURL: "mml.txt" });
    </script>
    ...
</body>
...
```
これでプレイヤーが貼り付けられます。  
プレイヤーは1つのページに何個でも貼り付けることができます。  
そのほか、[オプション](https://github.com/argentum384/flmml-on-html5/wiki/flmmlplayer#options)を指定することでプレイヤーの大きさや色合いを変えたりできます。

## For Developers
シーケンサ本体, プレイヤーUIの詳細な仕様は[wiki](https://github.com/argentum384/flmml-on-html5/wiki)をご覧下さい。  

### 開発環境構築
Windows 10で構築していますがMac, Linuxでも同じ手順で構築できると思われます\(未確認\)。  

以下2つのコンポーネント
* [Visual Studio Code](https://code.visualstudio.com/)
* [Node.js](https://nodejs.org/)

をインストールした後、シェルで以下コマンドを実行し`tsc`と`uglifyjs`をインストールします。
```
npm install -g typescript
npm install -g uglify-js
```
あとはVisual Studio Codeを起動し`/src/`ディレクトリを開けば準備完了です。  
`tasks.json` に2つのタスク  
* `compile`: TypeScriptのコンパイルのみ
* `compileAndMinify`: TypeScriptのコンパイル + jsファイル圧縮

を用意しています。

### 各js \/ tsファイルの自動生成

| ファイル | 自動生成 | 備考 |
| - | :-: | - |
| `*.ts` | × |  |
| `/src/flmmlonhtml5-raw.js` | × |  |
| `/src/flmmlworker-raw.js` | ○ | TypeScriptコンパイルで生成 |
| `/src/flmmlplayer-raw.js` | × |  |
| `/flmmlonhtml5.js` | ○ | `/src/flmmlonhtml5-raw.js`をminify |
| `/flmmlworker.js` | ○ | `/src/flmmlworker-raw.js`をminify |
| `/flmmlplayer.js` | ○ | `/src/flmmlplayer-raw.js`をminify |


## 謝辞
[FlMML](https://flmml.codeplex.com/)作者のおー氏をはじめ、FlMMLに新機能追加や不具合修正をされてきたコミッターの皆様や、FlMML on HTML5の不具合を報告頂いた方々といった、FlMML \/ FlMML on HTML5の発展に関わるすべての方々に感謝します。
