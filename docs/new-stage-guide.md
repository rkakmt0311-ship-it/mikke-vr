# 新しいステージの足し方

絵本は `js/stages/hub.js` の `BOOKS` に並んでいる。1冊目は屋根裏、2冊目は台所（`js/stages/kitchen.js`）。「ようかんの しょさい」（`mansion`）はまだ `ready: false` で開けない。新しいステージの見本には、短い `kitchen.js` が向いている。

## 手順

1. `js/stages/<名前>.js` を作り、`createXxx(game)` で下の「ステージの約束」を満たすオブジェクトを返す。屋根裏の `js/stages/attic.js` が見本。
2. `js/main.js` の `STAGES` に登録する。キーは `BOOKS` の `id` と同じにする。
3. `js/stages/hub.js` の `BOOKS` で、その絵本を `ready: true` にして `acts` を書く。形式は `'第一の幕　西日の さす ころ'`（全角スペースの前が幕、後ろが題）。
4. 書見台の表紙の裏の挿絵は `hub.js` の `plateOf` に足す。本は机に積まれ、押すと書見台の本と入れ替わる。
5. 音楽は `audio/bgm_<名前>.mp3` に置く。無くても静かに動く。
6. 外部素材を使ったら `assets/CREDITS.md` に書く。
7. 下の「確認すること」を通す。

## ステージの約束

| 項目 | 必須 | 内容 |
|---|---|---|
| `id` | ○ | `BOOKS` の `id` と同じ文字列。記録・しおりのキーになるので、公開後は変えない |
| `root` | ○ | ステージ全体の `THREE.Group`。離れるときに破棄される |
| `bounds` | ○ | 動ける範囲の `Box3` |
| `colliders` | ○ | ぶつかる物の `Box3` の配列 |
| `constrain(p, r)` | | 斜め天井など、箱で表せない動きの制限 |
| `spawn` | ○ | `{ pos, yaw }` 開始位置と向き |
| `bgm` | ○ | `audio/bgm_<名前>` の名前 |
| `ambience` | | `{ roomTone, lowpass, events }`。`events` は `audio.js` の `ambientEvents` のキー（今は `creak` と `chime` だけ） |
| `setPage(n)` | ○ | ページを組み立てて `{ targets, secret, title, hasLens }` を返す |
| `enter(scene, renderer)` | ○ | 背景・霧・環境光・露出を設定する |
| `update(dt, t, cam)` | ○ | 毎フレームの処理 |

`targets` と `secret` の中身は `{ id, name, obj }`。`obj` は `buildToy()` で作ると、押したときに見つけた判定になる（`userData.itemId` が付く）。

## 気をつけること

- **お題は1ページ6個にする。** 表紙の「あと ○つ」は `main.js` で `6 -` と決め打ち。
- **ルーペ専用のお題はステージ側で隠す。** `update` の中で `game.lens` を見て表示を切り替える（`attic.js` の `lensOnly`）。
- **軽くする。** おとりは `bakeStatic` で、お題は `mergeStatic` でまとめて描く。`game.quality.lite` が真のとき（Quest向け）は影を減らす。
- **おもちゃは全ステージ共通。** `js/catalog/toys.js` の約180種類から選ばれるので、海や洋館に合わない物も混ざる。必要なら種類を絞る仕組みを足す。
- **映り込みの光は共通。** `game.envTex` は屋根裏で撮ったHDRIなので、海では `enter` で別の物に替える。
- **`js/stages/toyroom.js` は見本にしない。** 古いおもちゃ部屋で、どこからも読み込まれていない。今の `toyroom` というIDの中身は `attic.js`。

## まだ無いもの

- **もくじの幕の数の上限。** 行の位置は幕3つ前提で並べている。4つ以上にするなら `hub.js` の `drawToc` と `actHits` の間隔を調整する。

## 確認すること

- 絵本の部屋 → もくじ → ページを選ぶ、で始まる
- メニューのページ一覧に、その絵本の幕が出る（PC／ゴーグル両方）
- 途中でやめると、表紙に「しおり」が出て続きから遊べる
- 全部見つけると「済」の印と記録が、その絵本のもくじに付く
- 1冊目の記録が消えたり混ざったりしない
- みんなで あそぶ で、なかまにも同じページが配られる
- Questの画質（`quest`）で動きが重くない
