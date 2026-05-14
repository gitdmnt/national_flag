# Plan: 日の丸ゲーム実装

## 要件 (ユーザー指定)
- 2:3 比率のキャンバスは最初真っ赤に塗られている。
- クリックするたびに、その座標を中心にランダムな大きさの「小片」が剥がれ、白い背景が露出する。
- 提出ボタンを押すと、残った図形 (赤領域) について次の 3 観点で 0〜100 点を採点する。
  - 真円にどれくらい近いか
  - 中心がキャンバス中央にどれくらい近いか
  - 直径が縦幅の 3/5 にどれくらい近いか
- 総合スコア (3 観点の平均、四捨五入) で判定:
  - 90 点未満: 画面が赤く点滅し「失敗！！ あなたのもとに警察がやってきました……」
  - 90 点以上 100 点未満: 「成功！！ あなたは真の愛国者です！！」
  - 100 点ちょうど: 「完璧！！ あなたこそが真の日本国民です！！」 + YouTube 君が代を自動再生
    - URL: https://www.youtube.com/watch?v=8kFWwuiUdT4 → 埋め込み: https://www.youtube.com/embed/8kFWwuiUdT4?autoplay=1
- 3 区分は排他 (完璧 → 成功メッセージは出さない、失敗 → 成功メッセージは出さない)。

## 採点定義 (ユーザー確認済)
- 総合 = round((circularity + center + diameter) / 3)
- 100 点を出すには 3 観点すべて 100 (実際は四捨五入なので 99.5 以上 3 つでも 100)。

## 全体方針
- 既存スタック: Bun + React 19 + Tailwind v4 + TypeScript (strict)。新規依存は追加しない。
- TDD: 採点ロジックは純粋関数として独立させ、`bun test` で先にテストを書く。
- 関数型: 副作用 (Canvas 描画) は React の `useEffect` / イベントハンドラに集約し、計算側は純粋関数のみ。

## ファイル構成
- `src/scoring.ts`: 採点ロジック (純粋関数群)
- `src/scoring.test.ts`: 採点ロジックのテスト (bun test)
- `src/peel.ts`: 剥がし用ポリゴン生成 (純粋、seed 注入可能な RNG を受け取る)
- `src/peel.test.ts`: ポリゴン生成のテスト
- `src/App.tsx`: UI (Canvas、状態、提出ボタン、結果表示)
- `src/index.css`: 点滅 keyframes 追加

## キャンバス仕様
- 内部解像度: width = 400, height = 600 (2:3)。
- 採点時にピクセル走査するのは 24 万要素、提出時 1 回限りなので十分許容範囲。
- CSS で `max-width: min(90vw, 400px)` 程度、`aspect-ratio: 2/3`。
- 下地は CSS で白。Canvas を最初に赤で塗りつぶす。
- 「白の露出」は Canvas 自体を透過にする方式: クリック時に `globalCompositeOperation = "destination-out"` で赤を削り、その下に CSS の白い領域が見える。
- クリック座標→Canvas 内部座標への変換:
  - `const rect = canvas.getBoundingClientRect()`
  - `const x = (e.clientX - rect.left) * (canvas.width / rect.width)`
  - `const y = (e.clientY - rect.top) * (canvas.height / rect.height)`

## 剥がし処理 (peel)
- `generatePeelPolygon({x, y, rng}): {x, y}[]`
  - 頂点数 N = 12 (定数)
  - 基本半径 r0 = rng.uniform(20, 60) px
  - 各頂点 i: 角度 θ_i = 2πi/N + rng.uniform(-π/N/2, π/N/2)、半径 r_i = r0 * rng.uniform(0.6, 1.2)
  - (x + r_i cos θ_i, y + r_i sin θ_i) を頂点列で返す
- 描画は App 側で `ctx.fillStyle = "rgba(0,0,0,1)"` + `globalCompositeOperation = "destination-out"` で多角形 fill。
- RNG はインターフェース `Rng = { uniform: (min, max) => number }`。本番では `Math.random()` ベース、テストでは決定論的シード版 (簡易 Mulberry32) を使う。

### peel.test.ts のテスト観点
- (a) 頂点数 = N。
- (b) 全頂点が中心 (x, y) から `r0 * 0.6` 〜 `r0 * 1.2` の範囲。
- (c) 同一 seed の RNG で同一頂点列。
- (d) 異なる seed なら頂点列が異なる。

## 採点アルゴリズム
すべて `ImageData` (またはマスク配列) を入力とする純粋関数。

1. `buildRedMask(imageData): Uint8Array`
   - 各ピクセルについて「α ≥ 128 かつ R ≥ 200 かつ G ≤ 100 かつ B ≤ 100」を 1、それ以外を 0。
   - 閾値は `const RED_THRESHOLDS` として export し、テストで境界確認。
2. `regionStats(mask, w, h): { area, cx, cy } | null`
   - area = 0 のときは null を返す。
   - area > 0 のとき重心 (cx, cy) を返す。
3. `effectiveRadius(area): sqrt(area / π)`
4. `scoreCircularity(mask, w, h): number`
   - regionStats が null なら 0。
   - 「理想円マスク」を 中心 = 重心 (cx, cy)、半径 = effectiveRadius で生成 (中央性とは分離するため、キャンバス中央ではなく重心基準)。
   - IoU = |actual ∩ ideal| / |actual ∪ ideal| を 0〜1 で計算 → ×100。
5. `scoreCenter(mask, w, h): number`
   - regionStats が null なら 0。
   - d = hypot(cx - w/2, cy - h/2)
   - max = h/2、score = max(0, 100 * (1 - d/(h/2))) (クリップ)
6. `scoreDiameter(mask, w, h): number`
   - regionStats が null なら 0。
   - target = 0.6 * h、actual = 2 * effectiveRadius(area)
   - score = max(0, 100 * (1 - |actual - target| / target))
7. `evaluate(imageData, w, h): { circle, center, diameter, total }`
   - 各 score を計算し、total = round((c + ce + d) / 3)。
   - area = 0 のときは {0, 0, 0, 0}。

### scoring.test.ts のテスト観点
- 理想円 (中央、直径 0.6H) を描いたマスク → 各観点 100、total 100。
- 中央からズレた円 → 中心スコア低下、真円と直径は高い。
- 中央にあるが直径が極端に小さい/大きい円 → 直径スコア低下、真円は高い。
- 正方形マスク → 真円スコア低下。
- 全て赤 (area = 全ピクセル) → 真円スコア・直径スコア低下、中心は重心が中央なので高い。
- 全て白 (area = 0) → total 0。
- 閾値境界: α=127 のピクセルは赤と認識しない、R=199 も同様。
- evaluate の total が平均の四捨五入と一致する (100, 100, 80 → 93、100, 100, 100 → 100)。

## UI / 状態
- React state:
  - `phase: "playing" | "result"`
  - `breakdown: { circle, center, diameter, total } | null`
- 提出ボタンを押すと `getImageData` してスコア計算 → phase = "result"。
- 「やりなおす」ボタンで Canvas を赤で塗り直し、phase = "playing"。
- 結果モーダルは Canvas の上に重ねる絶対配置の overlay。z-index を点滅 overlay より上に。
- 失敗 (< 90) 時は全画面 fixed overlay (半透明赤) を `animation: flash 0.4s ease-in-out infinite` で点滅。`pointer-events: none` でクリックを通す。テキスト・モーダルはさらにその上の z-index に固定して可読性確保。
- 100 点時のみ YouTube iframe (`src="https://www.youtube.com/embed/8kFWwuiUdT4?autoplay=1"`, `allow="autoplay"`) を結果モーダル内に表示。

## 受け入れ条件
- `bun test` が緑になる (scoring と peel のユニットテスト)。
- `bun dev` で起動し、赤いキャンバスが表示される。
- クリックで白い小片が露出する (複数回クリックで増える)。
- 提出ボタンで結果メッセージとスコア内訳が表示される。
- スコア < 90 で画面が赤く点滅する。
- スコア 100 で YouTube iframe が表示される (自動再生がブラウザにブロックされる場合はユーザーが iframe 内で再生 — フォールバック実装は不要)。

## スコープ外
- スコア履歴、共有、保存。
- モバイルタッチ最適化 (`onPointerDown` を使うので動く想定だが明示テストはしない)。
- アクセシビリティ、キーボード操作。
- 君が代音声のローカルホスティング (YouTube 埋め込みで十分)。
- 既存のロゴ表示や背景アニメーションの調整。
