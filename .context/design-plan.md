# Plan: コンシューマーゲーム風リデザイン

## ユーザー要求の整理
- frontend-design スキルの指針に従う
- アニメーションには framer-motion (`motion`) を使う
- コンシューマーゲーム風の見た目にする
- 長い文章 (オープニング、結果メッセージ) を分割して読みやすく表示
- ボタンに対する**ノーテーション** (キーバインドの可視化) を追加
- ゲームロジック (scoring, brush) は変更しない、UI のみ刷新

## アートディレクション

frontend-design スキルの原則 (generic AI aesthetic 回避、独自タイポグラフィ、大胆な色、空間構成、モーション) に従い、下記コンセプトを軸にする。実装前に frontend-design スキルの本文を改めて確認し、判断に迷ったらスキル指針を優先する。

**コンセプト: "特務任務 / Mission Briefing JRPG"**

JRPG のダイアログボックス + 格闘ゲームのボタンプロンプト + メタルギア的なミッションブリーフィングを組み合わせた、ドラマチックなコンシューマー風 UI。題材 (国旗修復) のシリアス・パロディ調にマッチさせる。

### カラーパレット (CSS変数で集約)
- `--ink: #0a0a0a` ベース背景 (墨)
- `--paper: #f5efe1` ダイアログ地紙
- `--hinomaru: #bc002d` 強調赤 (既存 #ef1c21 は canvas 内のみで継続使用)
- `--gold: #c9a961` 帝国ゴールド (装飾・ボタン枠)
- `--silver: #8a8a8a` サブテキスト
- 背景に**控えめな日章ライン** (放射状グラデーション + ノイズ)

### タイポグラフィ (Google Fonts、CDN 経由)
- 表示用 (タイトル・ヴァーディクト): **Reggae One** または **RocknRoll One** (太く劇的)
- 本文 (ダイアログ・解説): **Zen Kaku Gothic New** (読みやすい)
- スコア・キーキャップ: **DotGothic16** (8bit 数字感)
- ※ `Inter` / `Roboto` / system は使わない

### 装飾モチーフ
- ダイアログ角の **コーナーブラケット** (`⌐ ⌐` 形 / SVG)
- ボタンプロンプトは **キーキャップ風** (`⟨ ENTER ⟩` のような両端括弧 + 影)
- 結果画面の判定は **判子(はんこ)スタンプ** で叩きつける演出
- canvas は黒い額縁 + 金縁の二重枠で囲む

## 画面フェーズ (state machine)

現在: `"playing" | "result"`
変更後: `"briefing" | "playing" | "judging" | "result"`

| フェーズ | 内容 |
|---|---|
| `briefing` | **初回マウント時のみ** 表示。長文を 4 ページに分割しダイアログボックスで順送り |
| `playing` | 既存のゲームプレイ。HUD + キャンバス + ボタン |
| `judging` | 提出 → 結果表示の間の短い演出 (画面フラッシュ + "判定中…")。**`JUDGING_DURATION_MS = 900` の定数で固定**。コンシューマゲーム的な"溜め"の演出として追加 |
| `result` | スコア内訳と判定の劇的表示。完璧時のみ君が代 iframe |

「もう一度」「やりなおす」は **briefing をスキップして直接 `playing` に戻す**。`Esc` でブリーフィング全体をスキップ可能。

## 長文の分割案

オープニング (4 ページ):
1. 「大変だ！　日本の破壊を目論む悪の共産主義者スパイ軍団が——」
2. 「我々の誇りであり、魂の宿り木でもある日本国旗を、真っ赤に汚してしまいました！！」
3. 「このままでは日本は完全に共産主義の国になり、大量の移民が押し寄せ、天皇制が廃止され、なんと夫婦まで別姓になってしまいます！！」
4. 「愛国者よ——ジェット水流で真っ赤に汚されたキャンバスを洗い流し、完璧な日の丸を復元せよ！」

(ページ番号 `1/4` のインジケータも表示)

結果画面のメッセージはすでに 1〜2 文と短いので、現状のままタイトル+サブで表示。ただし**段階的に出現**させる (verdict → message → スコア → 君が代 iframe の順)。

## ボタンノーテーション仕様

画面下部に常時表示するキーヒントバーを追加。

| 状況 | 表示 |
|---|---|
| briefing | `⟨Enter / Space⟩ 次へ`, `⟨Esc⟩ スキップ` |
| playing | `⟨1⟩ ジェット`, `⟨2⟩ セミワイド`, `⟨3⟩ ワイド`, `⟨Enter⟩ 提出`, `⟨R⟩ やり直し` |
| result | `⟨Enter⟩ もう一度` |

各ブラシボタン・提出ボタン・やり直しボタン自身にも、ラベルの隣に小さなキーキャップを表示 (例: `[1] ジェットノズル`)。

キーボードイベントは `useEffect` 内で `window` に登録 / クリーンアップ。

## アニメーション設計 (framer-motion)

- **briefing 表示**: タイトルカードが上から落ちる → ダイアログがフェードイン+下から少し上昇 (`initial`/`animate`/`exit` + spring)
- **ページ送り**: `AnimatePresence` + `mode="wait"` で文字スライド (`x: 30 → 0 → -30`)
- **ブラシ選択**: 選択中は `scale: 1.05` + ゴールドのアウトラインが脈打つ (`animate` ループ)
- **キャンバス枠**: 提出時にホワイトフラッシュ → `judging` で短い "判定中…" → 検出円を `pathLength: 0 → 1` で描画
- **スコア表示**: `useMotionValue` + `animate` でカウントアップ、棒グラフが伸びる
- **判定スタンプ**: `scale: 2 → 1`, `rotate: -8`, ease-out で叩きつけ (フェイル時はさらに画面シェイク = 親要素に `x: [-6, 6, -4, 4, 0]`)
- **失敗フラッシュ**: 既存 CSS keyframes を維持。framer-motion とは独立して動作
- **完璧時**: ゴールドの脈動グロー + 紙吹雪 (シンプルに 30 個程度の `motion.div` を上から散らす)
- **reduced-motion 対応は framer 側に一本化**: motion の `useReducedMotion` を使い、アニメーションの duration を 0 にする / 静的状態だけ描画する分岐をかける。既存 `index.css` の `@media (prefers-reduced-motion) { animation: none !important; }` ブロックは**残す** (CSS 由来のフラッシュ keyframe を抑止するため)。両者は競合せず重複して安全側に倒れる。

## 依存追加
- `bun add motion@^12` で **`motion` パッケージ v12 系** を追加する。`framer-motion` パッケージは使わない。import 元は `"motion/react"`。

## ファイル変更 (最小構成)

| ファイル | 変更内容 |
|---|---|
| `package.json` | `motion` を追加 |
| `src/index.html` | Google Fonts (`Reggae One`, `Zen Kaku Gothic New`, `DotGothic16`) の `<link>` を追加。`<html lang="ja">` に修正 |
| `src/index.css` | Tailwind v4 の `@theme` ブロックで CSS 変数 (`--color-ink`, `--color-paper`, `--color-hinomaru`, `--color-gold`, フォントファミリー) を宣言。背景の放射状グラデーション + ノイズ、紙吹雪 keyframes、reduced-motion 対応 |
| `src/App.tsx` | フェーズ拡張 + UI 組み立て。スコア表示・判子・カウントアップ・ブラシ選択も本ファイル内 |
| `src/ui/BriefingScreen.tsx` (新規) | オープニング dialog 本体。`DialogBox` / `KeyCap` / `HintBar` を**同ファイル内**に同居 export し、App.tsx の playing/result フェーズ用にもインポート再利用する |
| `src/ui/keybindings.ts` (新規) | **純粋関数 `hintsForPhase(phase)` と `keyToAction(key, phase)`** を export。テスト対象 |
| `src/ui/keybindings.test.ts` (新規) | 上記純粋関数のユニットテスト |
| `src/ui/useKeyBindings.ts` (新規) | `keyToAction` を window イベントに接続するフック (テスト対象外、薄いラッパー) |

新規は **4 ファイル**。`scoring.ts` / `brush.ts` / それぞれのテストは**変更しない**。`src/index.html` は存在することを確認済み。

## 受け入れ条件
- `bun test` が緑であること (既存テスト未変更 + 新規 `keybindings.test.ts` も含めて緑)
- `bun dev` でブラウザ表示し、以下を目視確認:
  - 起動時にブリーフィング 4 ページが順送り可能 (クリックとキーボード両方)。`Esc` でスキップ可能
  - 「やりなおす」「もう一度」では briefing が再表示されず直接 playing に戻る
  - ブラシ切替が `1` / `2` / `3` キーで動く
  - `Enter` で提出、`R` でリセットが動く
  - 提出後に判定アニメーション (約 900ms) → スコアカウントアップ → 判子表示の順序で再生される
  - 100 点時に君が代 iframe が表示される
  - 90 点未満で既存の赤フラッシュが従来通り動作
  - キーボードショートカットなしでも、すべてマウス/タッチで操作可能
  - 既存の `aria-pressed` / `role="group"` (ブラシ選択) を維持
  - OS で reduced-motion を有効化した状態でも全フローを最後まで進められる (派手なアニメーションは抑制されるが操作は可能)
- TypeScript strict でエラーが出ないこと

## スコープ外
- 採点ロジック・ブラシロジックの変更
- BGM / SE の追加 (君が代以外)
- セーブ・スコア履歴・共有
- 多言語 (日本語のみ)
- IE / レガシーブラウザ対応

## テスト方針 (TDD)

CLAUDE.md の TDD ルールに従い、**先に `keybindings.test.ts` を書いて Red → 実装で Green → リファクタ** の手順を守る。

純粋関数として切り出してテスト対象にする:
- `hintsForPhase(phase: Phase): readonly KeyHint[]` — 各フェーズで返るヒント集合 (順序・キー・ラベル)
- `keyToAction(key: string, phase: Phase): Action | null` — キーコード → アクション解決 (例: `"Enter"` + `playing` → `"submit"`)

テストケース:
- `hintsForPhase("briefing")` が `next` と `skip` を含む
- `hintsForPhase("playing")` が `brush1`, `brush2`, `brush3`, `submit`, `reset` を含む
- `hintsForPhase("result")` が `retry` を含む
- `hintsForPhase("judging")` は空配列
- `keyToAction("Enter", "playing")` === `"submit"`
- `keyToAction("r", "playing")` === `"reset"` (大小文字を吸収)
- `keyToAction("1", "playing")` === `"brush_small"` など
- `keyToAction("Enter", "judging")` === `null` (受け付けない)

`useKeyBindings` フックは window event との橋渡しのみで、純粋関数を呼ぶだけの薄いラッパー。直接のテストは行わず、手動で動作確認。

その他の UI コンポーネント (DialogBox, KeyCap, HintBar, BriefingScreen) は表示寄りで純粋関数化困難のため、手動目視で確認。
