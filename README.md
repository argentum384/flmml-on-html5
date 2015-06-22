# FlMML on HTML5

[![Join the chat at https://gitter.im/carborane3/FlMMLonHTML5](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/carborane3/FlMMLonHTML5?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)  
The transplant of [FlMML](https://flmml.codeplex.com/), MML player which runs on Flash Player, to HTML5\.

---
Flash上でMMLを演奏する[FlMML](https://flmml.codeplex.com/)をHTML5環境上に移植したものです。

Web Audio, Web Workerを利用しているため現状動作ブラウザは限られますが、Flash版と比べ概ね軽快に動作します。  
[ニコニコ大百科](http://dic.nicovideo.jp/)で使われているものに近い、SVGを使用したプレイヤーUIも付属しています。  
![screenshot.gif](http://carborane3.github.io/FlMMLonHTML5/screenshot.gif "Screen Shot")  

デモはこちら  
[Demo page](http://carborane3.github.io/FlMMLonHTML5/)

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
そのほか、[オプション](https://github.com/carborane3/FlMMLonHTML5/wiki/flmmlplayer#options)を指定することでプレイヤーの大きさや色合いを変えたりできます。

## 対応ブラウザ
* 動作確認済み
    * Chrome
    * Chrome for Android
    * FireFox
    * Opera
    * Safari
    * Microsoft Edge
* 対応したはずが動作せず \(動作確認報告求む\)
    * iOS Safari
* 非対応確認済み
    * Internet Explorer
    * Android Browser
    * Opera Mini

## For Developers
シーケンサ本体, プレイヤーUIの詳細な仕様は[wiki](https://github.com/carborane3/FlMMLonHTML5/wiki)をご覧になって下さい。

プロジェクト形式はVisual Studio for WebのTypeScriptを使用したWeb アプリケーションです。  
\.tsファイルをコンパイルして全て結合したのが`flmmlworker-raw.js`になります。  
`flmmlonhtml5-raw.js`, `flmmlplayer-raw.js`はそれらとは別に記述したJavaScriptファイルです。  
これら3つのファイルをそれぞれ[Online JavaScript/CSS Compressor](http://refresh-sf.com/)で圧縮したのが`flmmlworker.js`, `flmmlonhtml5.js`, `flmmlplayer.js`です。

## 謝辞
[FlMML](https://flmml.codeplex.com/)作者のおー氏と、CodeRepos/CodePlexにコミットし新機能追加や不具合修正をされてきた方々など、FlMMLの発展に関わってきたすべての方々に感謝します。
