# 234-kitaku-onigokko / 帰宅鬼ごっこ 〜交番までダッシュ〜

終電後の住宅街を三人称視点で逃げ、交番へ駆け込む3Dステルス鬼ごっこ。
実装は `index.html` 単体（three.js r128 をCDNから読み込み）。BGMは `audio/`。

## 世界観・トーン（2026-09-16 改訂）

**パンク × 冷たい恐怖**。フライヤー1枚。説明しない。
骨色 `#efe6d8`／氷 `#9aa8b4`／血 `#9a2030`／墨 `#05060a`。明朝の巨大見出し＋スタンプ。ネオンは使わない。

## 画面構成

| 画面 | 内容 |
|---|---|
| タイトル | スタンプ `LAST TRAIN`、見出し「帰宅／鬼ごっこ」、`DEAD STREET`、BEST（あるときだけ）、`TAP`。操作説明・あらすじなし |
| プレイ | HUD（TIME／1 / 5／状態／スタミナ・気配・息／MAP）＋仮想パッド。面が変わると中央に `STAGE n` がぼやけて浮かび、2.6秒で消える |
| ポーズ | `HALT`／`PAUSE`。TIME、RESUME／RESET |
| ゲームオーバー | `CAUGHT`／「つかまった」／`NO WITNESS`。生存時間／交番。赤ヴィネット |
| クリア | `SAFE?`／「逃げ切った」／`TONIGHT ONLY`。TIME／RANK／BEST。「あしたも同じ道を通る」 |

RANK基準（5ステージ通し）: S <180秒 ／ A <280秒 ／ B <400秒 ／ それ以上 C。

## 操作／設定UI（コントロールパネル）

- **入力は Pointer Events に一本化**。`touchstart`+`mousedown` の二重バインドはしない
- 仮想パッドは **DOMオーバーレイ**（canvas内に描かない）。`#stick`（アナログ）／`ダッシュ`／`かくれる`／視点 `◀▶`
- 全ボタンで **`setPointerCapture`**。指がボタンから外れても離すまで押しっぱなしを保持する
- **ミュート**（右上 ♪／✕・`M`キー）と**明示ポーズ**（右上 Ⅱ・`P`/`Esc`）を常時表示。オーバーレイ表示中も押せる（`#sysbar{z-index:30}`）
- `visibilitychange` で裏に回ったら自動ポーズ
- パッド表示時は `body.touchmode` を付与し、HUDをパッドと重ならない位置へ退避する
  - スタミナ／気配：画面左上（TIMEの直下）。スティック上へ上げると三人称の主人公と重なる
  - MAP：右上（ミュート／ポーズの下）

### localStorage キー（`tg.<番号>.<key>` 形式）

| キー | 内容 |
|---|---|
| `tg.234.mute` | ミュート状態（`"1"`/`"0"`） |
| `tg.234.best` | 最速クリアタイム（秒・文字列） |

## iOS対応

`viewport-fit=cover` ＋ `maximum-scale=1`、`-webkit-tap-highlight-color:transparent`、
`-webkit-touch-callout:none`、body `touch-action:manipulation` ／ canvas `touch-action:none` の2段構え、
`overscroll-behavior:none`、ダブルタップ300ms抑止、`dblclick`／`contextmenu`／`gesturestart` 抑止、
WebAudio unlock（`pointerdown`／`keydown`／各ボタン押下で `resume()`）、
HUD・パッドは `env(safe-area-inset-*)` を加算。

## 音声

- BGM: `audio/Behind_The_Locked_Gate.m4a`（AAC-LC 96kbps・本命）／ `audio/Behind_The_Locked_Gate.mp3`（フォールバック）
- `<audio id="bgm" loop preload="none">`。最初のタップ／キーの `play()` で読み込み開始（`new Audio()` は使わない）
- タイトルとプレイ中はループ。ポーズ・ゲームオーバー・クリア・ミュート・裏画面では pause
- 鬼が **20m以内** に近づくと BGM 音量が **1.1倍**。**22m以上** 離れると元の音量へ戻す（境界の点滅防止）
- 効果音は従来どおり WebAudio の短いトーン。ミュート（`tg.234.mute`）は BGM と SE を両方止める

## ゲームルール

- 鬼は**音と視線**で追う。街灯の下（明るい場所）ほど視認距離が伸びる
- ダッシュはスタミナを消費し足音が響く。物陰（自販機・植込み・車・路地）に隠れると息ゲージが減る
- **5ステージ**。交番に到達すると次のステージへ進み、交番は別の場所へ移る
- ステージ n では色の違う鬼が n 体（赤→青→黄→緑→白）。5体目の交番でクリア
- 鬼の見た目はプレイヤーの約2倍（`ONI_SCALE=2`）。速度・視界は据え置き
- 鬼に**2.0m**以内まで詰められると捕獲。隠れ中は**1.35m**まで寄られないと捕まらない（旧 1.5 / 1.0）

## 既知の注意点

- **three.js をCDN（cdnjs）から読み込むため、オフラインでは起動しない**。`THREE` 未定義時はパネルに読み込みエラーを出す
- 2026-09-18: タイトル幕を canvas より前に置き、`TAP` を `<button>` 化した。harness のタップは PASS（以前の偽陽性は解消）
