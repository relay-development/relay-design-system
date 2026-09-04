# Icons（Lucide SVG sprite）

[Lucide](https://lucide.dev) から 53 アイコンを SVG sprite として同梱しています。JS フレームワーク不要、`currentColor` で着色追従します。

## 使い方

### Vite / Webpack / Next.js の場合

```ts
import iconsUrl from "@light-right/design-system/icons";

<svg className="icon icon-md">
  <use href={`${iconsUrl}#lucide-search`} />
</svg>
```

### vanilla HTML の場合

```html
<svg class="icon icon-md">
  <use href="./node_modules/@light-right/design-system/dist/icons.svg#lucide-search"></use>
</svg>
```

### 単一 HTML ファイル / file:// で表示する場合（インライン symbol）

外部の `icons.svg#id` 参照は file:// で開いた文書では描かれません（別ファイル扱いになるため）。プロトタイプの単一 HTML やメールなどスプライトを配信できない場面では、必要なアイコンの `<symbol>` を文書内に一度定義し、同一文書の `#id` で参照します。

```html
<svg hidden aria-hidden="true" focusable="false">
  <symbol id="lucide-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</symbol>
</svg>

<svg class="icon icon-md" aria-hidden="true"><use href="#lucide-search"></use></svg>
```

symbol の markup は MCP の `get_icon("search")` がそのまま返します（自分でパスを描いたり dist/icons.svg を grep したりする必要はありません）。どちらの書き方でも class は `icon` + サイズクラス（`icon-md` 等）を必ず併記します。`.icon` 単体にはサイズが無く、省くと SVG 既定の 300×150px で描かれます。

## サイズ

| クラス | px |
|---|---|
| `.icon-xs` | 12 |
| `.icon-sm` | 16 |
| `.icon-md` | 20 (default) |
| `.icon-lg` | 24 |
| `.icon-xl` | 32 |

## 着色

`currentColor` を継承します。`text-primary-500` / `text-fg-low` などのトークンユーティリティで色付け可能。

## 同梱アイコン一覧

カタログの [アイコンページ](https://relay-development.github.io/relay-design-system/icons.html) を参照。
追加して欲しい Lucide アイコンがあれば [GitHub Issue](https://github.com/relay-development/relay-design-system/issues) で。

## ビルドの仕組み

`scripts/build-icons.mjs` が Lucide subset から `dist/icons.svg` と `examples/icons.svg`（gitignored）を生成します。
