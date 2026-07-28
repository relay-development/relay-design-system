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
