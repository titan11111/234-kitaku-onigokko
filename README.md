# 帰宅鬼ごっこ｜終電の影

駅から自宅まで、鬼の追跡をかわしながら逃げる3Dブラウザゲームです。

このプロジェクトに `index.html` はありません。Vinext/Next形式のため、ブラウザの入口は `app/page.tsx` です。

## 開発

- Node.js `>=22.13.0`
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

## 操作

- PC: WASD / 矢印キーで移動、Shiftで走る、Eで隠れる
- スマホ: 左下の仮想スティックで移動、右下の「走る」、近くで「隠れる」
- 移動方向はカメラ基準です。開始直後2.5秒は鬼の速度が下がります。

## 構成

- `app/`: ゲーム本体・画面・スタイル
- `components/ui/`: 現在使用しているUI部品
- `public/`: 公開アセット
- `scripts/`: 開発・ビルド補助
- `vendor/`: UIスタイル依存

ゲームに未使用だったスターター部品・D1サンプル・Drizzle設定・未使用アセットは、削除せず次の退避先へ移動しています。

`/private/tmp/234-kitaku-onigokko-optional-2026-09-13`
