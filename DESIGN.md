# relay Design System — Design Constitution

> AI エージェントが relay UI を生成するとき、最初に読むファイル。
> 思想・非交渉原則・クイックリファレンス・参照先をこの 1 枚に集約する。

---

## Brand Identity

**"トークン経由でしか描かない"** — Figma が正本、コードは派生。手作業の値は混ぜない。

| キーワード | 意味 |
|---|---|
|  |  |

> _キーワード一覧はチームで議論中。決定次第ここに追記する。_

参考: Linear / Notion / Stripe — 控えめで機能的、しかし精密
アンチ: 7px や 14.5px のような off-scale 値 / `#334155` のような直書き色

---

## Non-Negotiable Principles

1. **ハードコーディング禁止** — pixel / hex / 生数値で直書きしない。必ずトークン or ユーティリティ経由
2. **Semantic Color** — `bg-primary-500` / `text-fg-high` を使う。`bg-slate-700` のような primitive 直参照は最終手段
3. **Blessed Spacing** — `p-{0,1,2,3,4,6,8,12,16}` のみ使う。5 / 7 / 9 / 10 などの倍数は使わない
4. **Typography セマンティック層** — `.typo-{xsmall..3xlarge}` を使う。生の `text-sm` / `text-base` は禁止
5. **ARIA 属性で状態を表現** — `[aria-pressed="true"]` / `[aria-selected="true"]` / `:disabled` を CSS selector に使う
6. **Figma → コード の片方向同期** — Figma が正本。コードから Figma に逆流はしない
7. **main 直 push 禁止** — すべて feature branch + PR + squash merge

> 詳細は [CLAUDE.md](CLAUDE.md) の「🔴 必須ルール: ハードコーディング禁止」と「やってはいけないこと」を参照。

---

## Quick Reference

> この section だけで基本的な relay UI コード生成が可能。

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
本文テキスト (中優先)      : text-fg-middle (slate-700, ≈10.7:1)
補助テキスト (AA まで)     : text-fg-low (slate-500, ≈4.5:1)
反転テキスト               : text-fg-high-inverse (white)
ボーダー                   : border-stroke-{high,middle,low}
ステータス                 : {success,warning,negative,info}-{50..950}
背景ページ                 : bg-bg-page (white) / bg-bg-page-green (primary-50)
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
.typo-large     : 20px / 32px
.typo-xlarge    : 24px / 32px
.typo-2xlarge   : 32px / 40px  ← セクション見出し
.typo-3xlarge   : 40px / 48px  ← ページタイトル
.typo-article   : 16px / 32px  ← 記事・読み物用 (regular, 広め行間) の独立スケール
フォントスタック : Noto Sans JP, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
ウェイト         : font-{thin,light,normal,medium,bold,black} (100..900)
```

**`text-sm` / `text-base` を直接書かない。** 必ず `.typo-*` を経由。

### Radius / Shadow

```
border-radius   : rounded-{none,xs,sm,md,lg,full}  (= 0 / 2 / 4 / 8 / 12 / 9999 px)
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
Label Control      : <div class="label-control">...label + badge-required/optional + 入力欄...</div>
Filter Chip        : <button class="filter-chip" aria-pressed="false">...</button>
Tab                : <div class="tabs tabs-solid"><button class="tab tab-solid" aria-selected="true">...</button>...</div>
Simple Table       : <table class="simple-table"><tr><th>ラベル</th><td>値</td></tr>...</table>
Card               : <div class="card"><div class="card-header">...</div><div class="card-body">...</div></div>
Badge              : <span class="badge badge-soft-primary">ラベル</span>
Alert              : <div class="alert alert-info"><span class="alert-icon">...</span><div class="alert-content">...</div></div>
```

### Icons (Lucide SVG sprite, 38 icons)

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
| `padding: 16px` | `p-4` または `calc(var(--spacing) * 4)` |
| `color: #334155` | `text-fg-middle` または `var(--color-fg-middle)` |
| `font-size: 14px` | `.typo-small` |
| `border-radius: 8px` | `rounded-sm` |
| `box-shadow: 0 1px 3px rgba(0,0,0,0.1)` | `shadow-sm` |
| `p-5` / `p-7` / `p-10` (祝福外) | `p-4` or `p-6` / `p-6` or `p-8` |
| `text-sm` 直書き | `.typo-small` |
| `bg-slate-700` (primitive 直参照) | `bg-fg-middle` (semantic) |
| `is-selected` クラス | `aria-selected="true"` |
| main へ直 push | feature branch + PR |

> ハードコード許容例外 (Figma 由来の 1 箇所限定装飾色、比率値 100% / auto 等) は [CLAUDE.md](CLAUDE.md#例外ハードコードを許容するケース) 参照。

---

## Source of Truth 読み順

> `CLAUDE.md` は Claude Code が起動時に自動で読み込むため本表には含めない (運用ガイドはそちら参照)。

| # | ファイル | 役割 |
|---|---|---|
| 1 | [DESIGN.md](DESIGN.md) (本ファイル) | 憲法 + quick reference |
| 2 | [README.md](README.md) | 全コンポーネントクラス一覧 + トークン参照表 |
| 3 | [src/tokens/](src/tokens/) | トークン定義 (colors / typography / spacing / radius / shadow) |
| 4 | [src/components/](src/components/) | 各コンポーネント CSS 実装 (1 component = 1 file) |
| 5 | [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | WCAG 2.1 AAA 実務チェックリスト |
| 6 | [docs/INTRODUCTION.md](docs/INTRODUCTION.md) | 全体像・4 つの入口 (Figma / GitHub / Pages / npm) |
| 7 | [docs/WORKSHOP.md](docs/WORKSHOP.md) | Git / PR ワークフロー (非エンジニア向け) |
| 8 | [docs/RELEASING.md](docs/RELEASING.md) | npm publish + Slack 通知の手順 |
| 9 | [examples/index.html](examples/index.html) | 全コンポーネントの状態網羅プレビュー (live catalog) |

---

## Agent Prompt Guide

### クイック (単体 UI 生成)

`DESIGN.md` のみ読めば OK。Quick Reference のクラスをそのまま使う。

### 標準 (ページ単位)

`DESIGN.md` → `CLAUDE.md`「🔴 必須ルール」 → 該当コンポーネントの `src/components/*.css` を覗いて class API を確認 → 必要なら `examples/index.html` の対応 section で実例を確認。

### フル (新規コンポーネント追加 / トークン変更)

1. Figma `hJcKE8FkiyXtB1F9SuuE08` で仕様取得 (`mcp__claude_ai_Figma__get_design_context`)
2. CLAUDE.md「🎯 定型ワークフロー: Figma → 新規コンポーネント追加」の Phase 0〜9 に従う
3. `src/components/` に CSS / `src/index.css` に `@import` / `examples/index.html` にカタログセクション追加
4. README / INTRODUCTION のコンポーネント数を更新

---

## Theme

| 設定 | 値 |
|---|---|
| カラーモード | ライトのみ (ダークモード対応は将来検討) |
| Primary | `#30b686` (brand-green-500) |
| Primary hover | `#1b805e` (brand-green-600) |
| Font | Noto Sans JP + system fallbacks |
| Icon | Lucide subset 38 icons (SVG sprite) |
| Locale | ja (日本語) |
| ベーススペーシング | 4px (`--spacing: 0.25rem`) |
| アクセシビリティ | WCAG 2.1 AAA を目指す ([docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) 参照) |
| バージョン | npm `@light-right/design-system@0.3.0` |
| 配布 | npm + GitHub Pages カタログ |

---

## Versioning

| Bump | いつ | 例 |
|---|---|---|
| **patch** | バグ修正・スタイル微調整 | `0.3.0` → `0.3.1` |
| **minor** | 後方互換のあるコンポーネント / トークン追加 | `0.3.0` → `0.4.0` (Simple Table 追加時) |
| **major** | 破壊的変更 (クラス名 rename / トークン削除) | `0.x.x` → `1.0.0` |

リリース手順は [docs/RELEASING.md](docs/RELEASING.md) を参照。

---

## 関連リンク

- 本番カタログ: https://relay-development.github.io/relay-design-system/
- npm: https://www.npmjs.com/package/@light-right/design-system
- GitHub: https://github.com/relay-development/relay-design-system
- Figma: https://www.figma.com/design/hJcKE8FkiyXtB1F9SuuE08/relay-Design-System
