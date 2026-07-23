# relay Design System — Design Constitution

> AI エージェントが relay UI を生成するとき、最初に読むファイル。
> 非交渉原則とクイックリファレンスをこの 1 枚に集約する。この 1 枚だけで基本的な relay UI 生成が可能。

**"トークン経由でしか描かない"** — コードが正本、Figma はデザイン探求の場。手作業の値は混ぜない。
参考: Linear / Notion / Stripe — 控えめで機能的、しかし精密。アンチ: 7px のような off-scale 値 / `#334155` のような直書き色。

---

## デザイン原則

relay の UI が共通して持つべき 3 つの性格。トークンやコンポーネントの選択で迷ったら、この原則に照らして選ぶ。

1. **ゆったりとした余白** — 要素を詰め込まず、画面に呼吸をさせる。密度で情報量を稼がない。迷ったら祝福値の**広い方**を選ぶ（`p-4` か `p-6` で迷えば `p-6`）。セクション間は `gap-8` 以上を基準にする
2. **わかりやすい表現** — 可読性ファースト。本文は 16px（`.typo-medium`）基準を守り、補足・注記も反射的に `typo-small` へ下げず `typo-article` / `typo-medium` を第一候補にする。文言は平易な日本語で書き、専門用語・省略語・曖昧な言い回しを避ける
3. **明瞭な色使い** — 色は意味を運ぶ手段であり、装飾のために増やさない。基調はブランド緑 primary（+ 黄 secondary）に絞り、テキストは `fg-{high,middle,low}` ロールでコントラストを確保する。ステータス色（success / warning / negative / info）を意味以外に流用しない。背景色とその上に置く surface の境界が曖昧なとき（例: `neutral-50` 上の `primary-50` / `surface`）は、情報のグルーピングが弱くなるため**必ずボーダーを入れて**輪郭を示す（`border-stroke-*`、同系色で縁取るなら primary 系）

---

## Non-Negotiable Principles

1. **ハードコーディング禁止** — pixel / hex / 生数値で直書きしない。必ずトークン or ユーティリティ経由
2. **Semantic Color** — `bg-primary-500` / `text-fg-high` を使う。`bg-slate-700` のような primitive 直参照は最終手段
3. **Blessed Spacing** — `p-{0,1,2,3,4,6,8,12,16}` のみ使う。5 / 7 / 9 / 10 などの倍数は使わない
4. **Typography セマンティック層** — `.typo-{xsmall..3xlarge}` を使う。生の `text-sm` / `text-base` は禁止
5. **ARIA 属性で状態を表現** — `[aria-pressed="true"]` / `[aria-selected="true"]` / `:disabled` を CSS selector に使う
6. **デフォルトは medium** — コンポーネントサイズは例外を除き `md` を使う。タイポグラフィも基準は `.typo-medium` (16px)
7. **main 直 push 禁止** — すべて feature branch + PR + squash merge

---

## Quick Reference

### インストール + import

```bash
npm install @light-right/design-system
```

```ts
// アプリのエントリ (main.ts / _app.tsx / app.css)
import "@light-right/design-system/css";
```

これだけで `.btn` / `.input` / `.card` / `.alert` 等が使え、`bg-primary-500` / `text-fg-high` などのユーティリティも有効になる。

### Color Tokens

```
プライマリ (brand-green)   : bg-primary-500 (#30b686) / hover bg-primary-600
ニュートラル (slate)       : neutral-{50,100,200,...,950}
本文テキスト (高優先)      : text-fg-high (slate-900, コントラスト ≈18:1)
本文テキスト (中優先)      : text-fg-middle (slate-700, ≈10.4:1)
補助テキスト (AA まで)     : text-fg-low (slate-500, ≈4.5:1)
反転テキスト               : text-fg-high-inverse (white)
ボーダー                   : border-stroke-{high,middle,low}
ステータス                 : {success,warning,negative,info}-{50..950}
背景ページ                 : bg-page (white) / bg-page-green (primary-50)
```

> raw CSS で書く時: `var(--color-primary-500)` / `var(--color-fg-high)` 等。

### Spacing Scale (祝福される 9 段階)

```
spacing/0  = 0
spacing/1  = 4px       spacing/2  = 8px       spacing/3  = 12px
spacing/4  = 16px      spacing/6  = 24px      spacing/8  = 32px
spacing/12 = 48px      spacing/16 = 64px
```

→ utility: `p-{0,1,2,3,4,6,8,12,16}` / `m-{...}` / `gap-{...}`
→ raw CSS: `calc(var(--spacing) * N)` (N は祝福値)

**祝福外を使わない** — Figma で 40px / 56px が来たら近傍の祝福値 (32 or 48 / 48 or 64) に丸める。

### Typography

```
.typo-xsmall    : 12px / 16px line-height
.typo-small     : 14px / 24px
.typo-medium    : 16px / 24px  ← 本文 default
.typo-large     : 20px / 32px  ← ここから weight bold 必須
.typo-xlarge    : 24px / 32px
.typo-2xlarge   : 32px / 40px  ← セクション見出し
.typo-3xlarge   : 40px / 48px  ← ページタイトル
.typo-article   : 16px / 32px  ← 記事・読み物用 (regular, 広め行間) の独立スケール
フォントスタック : Noto Sans JP, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif
ウェイト         : font-{thin,light,normal,medium,bold,black} (100..900)
```

**ベースは `.typo-medium`（16px）。** 本文も各コンポーネント内のテキストも medium（16px）を基準サイズとして使う。補助・キャプションで下げる（small/xsmall）、見出しで上げる（large 以上）のは、この 16px ベースからの相対調整として選ぶ。

**`text-sm` / `text-base` を直接書かない。** 必ず `.typo-*` を経由。

**`.typo-large` 以上は weight bold 以上必須。** large〜3xlarge はデフォルトが `font-bold`。`font-semibold` / `font-medium` 等で bold 未満に下げない。weight の上書きは medium 以下のサイズのみ（例: `typo-medium font-bold` で本文強調）。

**`.typo-article` は原則 `text-fg-high` とセットで使う。** 読み物本文は高コントラストを確保する（例: `<p class="typo-article text-fg-high">`）。

### Radius / Shadow

```
border-radius   : rounded-{none,xs,sm,md,lg,full}  (= 0 / 4 / 8 / 16 / 24 / 9999 px)
shadow-sm       : 1px ドロップ
shadow-md       : 2 層 (Figma 仕様)
shadow-lg       : 2 層 (大きめ)
shadow-focus-ring : 0 0 0 3px #2563eb (focus-visible default)
shadow-destructive : 0 0 0 3px #ef4444 (削除ボタン focus)
```

### Components

```
Button (Primary M) : <button class="btn btn-md btn-primary btn-solid">保存</button>
Button (Outline)   : <button class="btn btn-md btn-primary btn-outline">編集</button>
Button (Negative)  : <button class="btn btn-md btn-negative btn-solid">削除</button>
Button サイズ      : btn-{sm,md,lg,xl} = h-{8,10,12,18} = 32 / 40 / 48 / 72 px
Icon Button        : <button class="icon-btn icon-btn-md icon-btn-primary icon-btn-solid" aria-label="次へ">...</button>
Input              : <input class="input input-md" />  /  エラー時: + .input-error
Search Input       : <div class="search-input search-input-md">...field + clear + submit...</div>
Selector / Select  : <div class="selector selector-md">...</div>
Textarea           : <div class="textarea-control"><textarea class="textarea textarea-md" maxlength="100"></textarea>...</div>
Checkbox / Radio   : <label class="checkbox-label"><input type="checkbox" class="checkbox" />ラベル</label>
Label Control      : <div class="label-control">...label + label-badge-{required,optional} + 入力欄...</div>
Filter Chip        : <button class="filter-chip" aria-pressed="false">...</button>
Tab                : <div class="tabs tabs-solid"><button class="tab tab-solid" aria-selected="true">...</button>...</div>
Simple Table       : <table class="simple-table"><tr><th>ラベル</th><td>値</td></tr>...</table>
Card               : <div class="card"><div class="card-header">...</div><div class="card-body">...</div></div>
Badge              : <span class="badge badge-soft-primary">ラベル</span>
Alert              : <div class="alert alert-info"><span class="alert-icon">...</span><div class="alert-content">...</div></div>
Link (本文中)      : <a class="link"><span class="link-label">リンクテキスト</span></a>  ← font-size は本文を inherit
```

> **サイズは例外を除き `md` をデフォルトに。** `btn` / `icon-btn` / `input` / `selector` / `textarea` 等のサイズ付きコンポーネントは、特段の理由（密なツールバーで `sm`、ヒーロー CTA で `lg/xl` 等）がない限り `*-md` を使う。`icon` も既定は `icon-md` (20px)。タイポグラフィの `.typo-medium` 基準と揃えると画面全体のリズムが安定する。

> **リンクテキストは必ず本文とフォントサイズを揃える。** `.link` は `font-size`/`line-height` を周囲から inherit するので、置いた本文 (typo-small / typo-medium 等) のサイズに自動追従する。リンクだけ別サイズにしない（末尾アイコンも 1em で連動）。

全コンポーネントのクラス一覧は [README.md](README.md)、完成形 HTML は `snippets/*.html` を参照。

### Icons (Lucide SVG sprite, 43 icons)

```
import iconsUrl from "@light-right/design-system/icons";
<svg class="icon icon-md"><use href={`${iconsUrl}#lucide-search`} /></svg>
```

```
.icon-xs = 12px  /  .icon-sm = 16px  /  .icon-md = 20px (default)  /  .icon-lg = 24px  /  .icon-xl = 32px
currentColor を継承するので text-primary-500 等で着色可能
```

### State (ARIA 属性ベース)

```
押下状態     : <button aria-pressed="true">  ← .filter-chip, toggle buttons
選択状態     : <button aria-selected="true"> ← .tab
無効状態     : disabled 属性 or class="..." disabled  ← :disabled が CSS で拾う
現在ページ   : <a aria-current="page">       ← navigation links
エラー       : .input-error / .alert-negative
```

### 禁止パターン要約 (Top 10)

| 禁止 | 代替 |
|---|---|
| `padding: 16px` `color: #334155` `font-size: 14px` 等の生値直書き | トークン / ユーティリティ経由（`p-4` / `text-fg-middle` / `.typo-small`） |
| `p-5` / `p-7` / `p-10`（祝福外 spacing） | 近傍の祝福値（`p-4` or `p-6` / `p-6` or `p-8`） |
| 新しい spacing トークンの追加（`--spacing-40` 等） | 祝福 9 段階に丸める |
| `text-sm` / `text-base` 直書き | `.typo-small` / `.typo-medium` |
| `bg-slate-700`（primitive 直参照） | semantic ロール（`bg-fg-middle` 等） |
| `typo-large` 以上で weight を bold 未満に下げる | デフォルトの bold のまま使う |
| 理由なく `sm` / `lg` サイズを選ぶ | 例外を除き `md` をデフォルトに |
| 独自ブランド色（青系等）の持ち込み | primary（緑）/ secondary（黄）+ ステータス色 |
| `is-selected` 等の状態クラス | `aria-selected="true"` 等の ARIA 属性 |
| main へ直 push | feature branch + PR |

### ハードコードを許容する例外

上記は原則。以下のケースに限りハードコードを許容する（いずれもコメントで由来を明記）:

| 状況 | 例 | 理由 |
|---|---|---|
| Figma 由来の **bespoke カラー** がパレットに無い | hero gradient `#d9ebea` / `#e7f6f6` | 1 箇所限定の装飾色。トークン化するほどではない。コメントで由来を明記 |
| Figma 仕様で **off-scale な余白** が出る | (例) コンポーネント内 7px パディング | 該当パーツで本当に必要なら raw 値 OK。ただしコメントで「Figma 仕様」と明記 |
| **比率・100% / auto** | `width: 50%` `height: auto` `inset: 0` | スケール非依存値はそのまま |

---

## グローバル設定

| 設定 | 値 |
|---|---|
| カラーモード | ライトのみ (ダークモード対応は将来検討) |
| Primary | `#30b686` (brand-green-500) / hover `#1b805e` (600) |
| Font | Noto Sans JP + system fallbacks |
| Icon | Lucide subset 43 icons (SVG sprite) |
| Locale | ja (日本語) |
| ベーススペーシング | 4px (`--spacing: 0.25rem`) |
| アクセシビリティ | WCAG 2.2 AAA を目指す ([docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)) |
| 配布 | npm `@light-right/design-system` + GitHub Pages カタログ + MCP リモート (Cloudflare Workers、[docs/MCP-TOOLS.md](docs/MCP-TOOLS.md)) |

---

## より深く知りたいとき

- **ページ単位の実装**: 本ファイル → 該当コンポーネントの [src/components/](src/components/)*.css で class API 確認 → 必要なら[カタログ](https://relay-development.github.io/relay-design-system/)で実例確認
- **新規コンポーネント追加 / トークン変更**: [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md)（CSS → カタログ → ドキュメント → PR の Phase 0〜9）。追加はコード上で行う（正本はコード）。Figma はデザイン探求の場で、Figma 発のデザインを取り込む場合のみ Phase 0 の仕様取得から始める
- **Git / PR 運用**: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) / **SemVer・リリース**: [docs/RELEASING.md](docs/RELEASING.md)
- **リンク**: [カタログ](https://relay-development.github.io/relay-design-system/) / [npm](https://www.npmjs.com/package/@light-right/design-system) / [GitHub](https://github.com/relay-development/relay-design-system)
