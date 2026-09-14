# 234-kitaku-onigokko / 帰宅鬼ごっこ 〜交番までダッシュ〜

終電後の住宅街を三人称視点で逃げ、交番へ駆け込む3Dステルス鬼ごっこ。
実装は `index.html` 単体（three.js r128 をCDNから読み込み）。

## 世界観・トーン（2026-09-14 改訂）

**サイバーパンク × ホラー**。タイトル／エンディングは「街の監視システムのログ」という体裁で、
プレイヤーを追跡対象として扱う。ネオン（シアン #00e5ff ／ マゼンタ #ff2d78）、走査線、
RGBずれのグリッチ、流れる警告テロップで構成する。

## 画面構成

| 画面 | 内容 |
|---|---|
| タイトル | `SECTOR-07 ∕ 00:14 ∕ 終電通過済み` タグ、グリッチ見出し「帰宅鬼ごっこ」、警告テロップ、操作表、最速記録、`▶ TAP / ENTER — 走れ` |
| プレイ | HUD（TIME／状態／スタミナ・気配・息／MAP）＋仮想パッド |
| ポーズ | `SYSTEM HALT`。経過時間、再開／最初から の2ボタン |
| ゲームオーバー | `SIGNAL LOST ∕ 追跡完了 ∕ 生体反応 消失`。赤ヴィネットが心拍。生存時間／交番の発見有無 |
| クリア | `SAFE HOUSE REACHED`。クリアタイム／RANK（S/A/B/C）／BEST。「――ただし、あしたも同じ道を通る。」 |

RANK基準: S <75秒 ／ A <120秒 ／ B <190秒 ／ それ以上 C。

## 操作／設定UI（コントロールパネル）

- **入力は Pointer Events に一本化**。`touchstart`+`mousedown` の二重バインドはしない
- 仮想パッドは **DOMオーバーレイ**（canvas内に描かない）。`#stick`（アナログ）／`ダッシュ`／`かくれる`／視点 `◀▶`
- 全ボタンで **`setPointerCapture`**。指がボタンから外れても離すまで押しっぱなしを保持する
- **ミュート**（右上 ♪／✕・`M`キー）と**明示ポーズ**（右上 Ⅱ・`P`/`Esc`）を常時表示。オーバーレイ表示中も押せる（`#sysbar{z-index:30}`）
- `visibilitychange` で裏に回ったら自動ポーズ
- パッド表示時は `body.touchmode` を付与し、HUD（スタミナ／MAP）をパッドと重ならない位置へ退避する

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

## ゲームルール

- 鬼は**音と視線**で追う。街灯の下（明るい場所）ほど視認距離が伸びる
- ダッシュはスタミナを消費し足音が響く。物陰（自販機・植込み・車・路地）に隠れると息ゲージが減る
- 交番に到達でクリア、鬼に1.5m以内まで詰められると捕獲

## 既知の注意点

- **three.js をCDN（cdnjs）から読み込むため、オフラインでは起動しない**。`THREE` 未定義時はパネルに読み込みエラーを出す
- `_tools/game-harness.sh` の「タップ」判定は、タイトル幕が canvas を覆う構造のため**構造的にFAIL**になる（偽陽性。`docs/audit-calibration.md` 2026-09-12／2026-09-14 参照）
