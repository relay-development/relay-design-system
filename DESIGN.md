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
7. **テキストリンクは `.link` で、常に下線** — ナビゲーション可能なテキスト（a 要素）は、本文中に限らずフッター・表セル・フォーム脇の補助導線でも `.link` + `.link-label` で組む（独自クラスや `underline text-primary-700` の直付けで自作しない）。下線はデフォルトで付ける。下線の省略は、ボタン形状・アイコンボタン・メニュー項目（`.menu-item` のような角丸・背景付きの項目形状）など「テキストリンクに見えない見た目」を意図的に選んだ場合のみ許される。hover 時にのみ下線を出すパターンは禁止
8. **フォーカスリングは info（青 `#2563eb`）＋ 絶対に見切れさせない** — キーボードフォーカスの可視化は `--shadow-focus-ring`（`0 0 0 3px #2563eb`）または `outline-info-600` のみ。色を変えない（primary 緑などにしない）。リングを祖先の `overflow-hidden` / `overflow: clip` でクリップしない — 角丸コンテナで囲む時は `overflow-hidden` に頼らず first/last の子側で角丸を作り、リングを全周見せる。`outline: none` の付けっぱなし・hover 時のみ表示も禁止
9. **main 直 push 禁止** — すべて feature branch + PR + squash merge

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

### Container (コンテンツ領域幅)

```
--container-page    : 76.25rem (1220px)  → max-w-page / .page-shell            ページシェル (ヘッダー / フッター / 一覧)
--container-content : 56.25rem (900px)   → max-w-content / .page-shell-content 主コンテンツ (フォーム / 設定 / 詳細)
--container-article : 42rem (672px)      → max-w-article                       長文本文 (規約・記事系)
```

**一覧・帯は page、フォームや設定・詳細は content、長文本文は article。** サイズ名 (`max-w-5xl` 等) の新規使用は非推奨。
page の値は旧サイト実測 1220px の暫定（丸めはデザイナー判断、正本は `src/tokens/container.css`）。

### Typography

```
.typo-xsmall    : 12px / 16px line-height
.typo-small     : 14px / 24px
.typo-medium    : 16px / 24px  ← 本文 default
.typo-large     : 20px / 32px  ← ここから weight bold 必須
.typo-xlarge    : 20→24px / 32px   ← モバイル→md(768px)。以下同じ
.typo-2xlarge   : 24→32px / 32→40px ← セクション見出し
.typo-3xlarge   : 32→40px / 40→48px ← ページタイトル
.typo-article   : 16px / 32px  ← 記事・読み物用 (regular, 広め行間) の独立スケール
フォントスタック : Noto Sans JP, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif
ウェイト         : font-{thin,light,normal,medium,bold,black} (100..900)

見出し (large 以上) はモバイルで 1 段小さくなり md 以上で規定サイズに戻る（クラス自体が
レスポンシブ。md:text-* を手で足さない）。本文 (medium 以下・article) は 16px 基準を守り縮めない。
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

**elevation（浮き上がり）の表現にシャドウを使わない。** 恒常的に画面に置く surface（カード・パネル等）は `border-stroke-*` のボーダー + 背景色で区切る。`shadow-{sm,md,lg}` を使ってよいのは modal / tooltip など**実際に最前面へ重なる一時レイヤーだけ**。

### Components

```
Button (Primary M) : <button class="btn btn-md btn-primary btn-solid">保存</button>
Button (Outline)   : <button class="btn btn-md btn-primary btn-outline">編集</button>
Button (Negative)  : <button class="btn btn-md btn-negative btn-solid">削除</button>
Button サイズ      : btn-{sm,md,lg,xl} = h-{8,10,12,18} = 32 / 40 / 48 / 72 px
Icon Button        : <button class="icon-btn icon-btn-md icon-btn-primary icon-btn-solid" aria-label="次へ">...</button>
Button Group       : <div class="btn-group" role="group" aria-label="テキストの編集"><button class="btn btn-md btn-neutral btn-outline">コピー</button>…</div>  ← 同じ対象への関連した操作を 2〜4 個つなげる。中は同じ variant（outline）・サイズで揃える。選択状態を持つ切替には使わない（→ toggle-btn-group / tab / radio）
Toggle Button Group: <div class="toggle-btn-group" role="group" aria-label="表示形式" data-selection="single"><button class="btn btn-md btn-neutral btn-ghost" aria-pressed="true">一覧</button>…</div>  ← 選択状態を持つボタンの並び。単一選択（data-selection="single"・常に 1 つ pressed）= 同じ内容の見え方の切替（一覧 / グリッド、並び順）、複数選択（"multiple"）= 書式・表示オプションの ON/OFF。中は btn / icon-btn の neutral ghost。中身（パネル）の切替は tab、絞り込みは filter-chip / tab
Input              : <input class="input input-md" />  /  エラー時: + .input-error
Search Input       : <form role="search"><div class="search-input search-input-md">...field + clear + submit...</div></form>  ← 送信ボタンは全サイズ必須（md / lg は .search-input-submit、sm は虫眼鏡の .search-input-submit-icon）。検索は送信ボタンか Enter で確定してから実行し、入力のたびに結果を変えない（.search-input-icon は非推奨）
Token Input        : <div class="token-input"><div class="token-input-field"><input class="input input-md">…<button class="btn btn-md btn-neutral btn-outline">追加</button></div><ul class="token-input-list" aria-label="追加した担当者"><li class="token-input-item"><span class="token-input-label">山田</span><button class="token-input-remove" aria-label="『山田』を削除">×</button></li></ul></div>  ← 複数の値を 1 つずつ追加・削除する入力欄。トークンは入力欄の下（中に入れない）。追加は Enter か「追加」で確定、追加・削除は aria-live で告知、削除後は次のトークンか入力欄へフォーカス
Select             : <select class="select">...</select>  ← ネイティブ select は常に .select（見た目は Input と同一）
Selector           : <div class="selector selector-md"><select class="select">...</select></div>  ← アイコン枠・サイズ・エラー枠が要るとき（selector-field は非推奨エイリアス）
Textarea           : <div class="textarea-control"><textarea class="textarea textarea-md" maxlength="100"></textarea>...</div>
Checkbox / Radio   : <label class="checkbox-label"><input type="checkbox" class="checkbox" />ラベル</label>
Label Control      : <div class="label-control">...label + label-badge-{required,optional} + 入力欄...</div>
Filter Chip        : <button class="filter-chip" aria-pressed="false">...</button>  ← 複数同時選択の絞り込みトグル（button 専用）。「1 つ選ぶと他が外れる」絞り込みは Tab、表示形式の切替は Toggle Button Group、フォームの単一選択は Radio / Select
Tab                : <div class="tabs tabs-solid"><button class="tab tab-solid" aria-selected="true">...</button>...</div>  ← 同一画面内で表示する中身（パネル）の切替。一覧を 1 つの軸（すべて / 有望 …）で切り替える単一選択の絞り込みもこれ（tabs-line + .tab-count で件数）
Simple Table       : <table class="simple-table"><tr><th scope="row">ラベル</th><td>値</td></tr>...</table>  ← 1 件の詳細（キー/値）。ラベル列 128px 固定、列幅は触らない
Data Table         : <table class="data-table"><thead><tr><th scope="col">…</th></tr></thead>…</table>  ← 複数件の比較。列幅は「締める列」だけ指定: 固定書式の列（日付・状態・金額・操作）は th と同列の td に .data-table-fit（数値は .data-table-num）、自由文は .data-table-text の 1 列、残りは自動幅。収まらなければ <div class="data-table-wrap" tabindex="0"> で横スクロール。列の値で行を絞り込むなら見出しに列フィルター（.data-table-filter ＋ Popover の .data-table-filter-panel に select と「リセット」「適用」。action-menu は使わない）。並べ替えは見出しの文字を <button class="data-table-sort"> にし、並べ替え中の th にだけ aria-sort。表のタイトルと表全体への操作は表の上の .data-table-header にまとめる（1 段目に .data-table-title、2 段目の .data-table-toolbar の左に表示件数 .data-table-count（aria-live）、右の .data-table-actions に「検索（form role="search" ＋ search-input-sm ＋ 送信の .search-input-submit-icon。押す・Enter で確定してから絞り込み、入力のたびには変えない）→ アイコンの操作 3 個まで（tooltip。絞り込み・並べ替えのパネルは data-table-filter-panel。並べ替えは列見出しの data-table-sort と連動）→ btn-primary 1 つ」を sm で。複数条件の絞り込みは data-table-filter-panel ＋ .data-table-filter-field。適用中の条件は操作の行の下の .data-table-conditions に token-input-item で並べ、× で 1 つ・「すべて解除」で全部を解除。表は aria-labelledby でタイトルを名前にする）
Card               : <div class="card"><div class="card-header">...</div><div class="card-body">...</div></div>  ← パート間は区切り線なし（余白で区切る）。任意パーツ: header 先頭に .card-icon、上端に img.card-image（alt 必須）、本文末尾に ul.card-metadata、header 右上に .card-action（操作 1 つ）。密な一覧は .card-compact、本文を端まで敷くなら .card-body-flush。カード全体をリンクにするなら .card-clickable ＋ card-title 内の <a class="card-link">（カードを a で包まない・div に onclick を付けない。中のボタンは単独で押せる）
Action Menu        : <button class="icon-btn …" aria-haspopup="menu" aria-expanded="false" popovertarget="m1">…</button><div class="action-menu" id="m1" popover role="menu"><button class="menu-item" role="menuitem" tabindex="-1">編集</button>…</div>  ← ボタンから開く「その場の操作」のポップアップ（編集 / 複製 / 削除）。右寄りのトリガーは .action-menu-end、取り消せない操作は .action-menu-item-danger。遷移・値の選択には使わない
Badge              : <span class="badge badge-soft-primary">ラベル</span>
Alert              : <div class="alert alert-info"><span class="alert-icon">...</span><div class="alert-content">...</div></div>  ← ページ全体に向けた常設のお知らせ（Banner）
Inline Message     : <p class="inline-message inline-message-success" role="status"><svg class="inline-message-icon" aria-hidden="true">…</svg><span class="inline-message-text">保存しました</span></p>  ← 操作した場所の直近（ボタン横・フォーム直下・行内）に置く結果表示。theme は success / negative / warning / neutral、密な場所は .inline-message-sm
Link (テキストリンク): <a class="link"><span class="link-label">リンクテキスト</span></a>  ← a 要素のテキストリンクは置き場所を問わずこれ（本文・フッター・表セル・フォーム脇）。font-size は本文を inherit。緑を抑えたい補助リンクは .link-neutral、暗い背景上は .link-inverse（白）
Page Shell         : <div class="page-shell">…</div>  ← ページ幅の定型 (max-w-page + 中央寄せ + 左右 16px)。フォームや設定・詳細は <div class="page-shell page-shell-content"> で 900px に絞る
```

> **サイズは例外を除き `md` をデフォルトに。** `btn` / `icon-btn` / `input` / `selector` / `textarea` 等のサイズ付きコンポーネントは、特段の理由（密なツールバーで `sm`、ヒーロー CTA で `lg/xl` 等）がない限り `*-md` を使う。`icon` も既定は `icon-md` (20px)。タイポグラフィの `.typo-medium` 基準と揃えると画面全体のリズムが安定する。

> **リンクテキストは必ず本文とフォントサイズを揃える。** `.link` は `font-size`/`line-height` を周囲から inherit するので、置いた本文 (typo-small / typo-medium 等) のサイズに自動追従する。リンクだけ別サイズにしない（末尾アイコンも 1em で連動）。ウェイトは bold 固定なので `font-*` を足さない。

全コンポーネントのクラス一覧は [README.md](README.md)、完成形 HTML は `snippets/*.html` を参照。

### Icons (Lucide SVG sprite, 58 icons)

```
import iconsUrl from "@light-right/design-system/icons";
<svg class="icon icon-md" aria-hidden="true"><use href={`${iconsUrl}#lucide-search`} /></svg>
```

装飾アイコンは `aria-hidden="true"`（読み上げさせない）。単独で意味を運ぶアイコンは `aria-hidden` を外し `aria-label` か `<title>` を付ける。アイコンボタンは `icon-btn` 側に `aria-label`、SVG は `aria-hidden`。

```
.icon-xs = 12px  /  .icon-sm = 16px  /  .icon-md = 20px (default)  /  .icon-lg = 24px  /  .icon-xl = 32px
currentColor を継承するので text-primary-500 等で着色可能
```

### State (ARIA 属性ベース)

```
押下状態     : <button aria-pressed="true">  ← .filter-chip, .toggle-btn-group 内のボタン
選択状態     : <button aria-selected="true"> ← .tab
無効状態     : disabled 属性 or class="..." disabled  ← :disabled が CSS で拾う
現在ページ   : <a aria-current="page">       ← navigation links
エラー       : .input-error / .inline-message-negative（操作直近） / .alert-negative（ページ級）
```

### 禁止パターン要約

| 禁止 | 代替 |
|---|---|
| `padding: 16px` `color: #334155` `font-size: 14px` 等の生値直書き | トークン / ユーティリティ経由（`p-4` / `text-fg-middle` / `.typo-small`） |
| 画面の隅に固定して時間で消えるトースト／スナックバーの自作（`fixed bottom-4 right-4` + `setTimeout` 等）・`.alert` をその代用にする | 結果が画面で自明なら出さない。操作直近の結果は `.inline-message`、ページ全体への常設のお知らせは `.alert`、操作を止めて判断を求めるエラーは `.modal`。時間で消える通知は作らない |
| `p-5` / `p-7` / `p-10`（祝福外 spacing） | 近傍の祝福値（`p-4` or `p-6` / `p-6` or `p-8`） |
| 新しい spacing トークンの追加（`--spacing-40` 等） | 祝福 9 段階に丸める |
| `text-sm` / `text-base` 直書き | `.typo-small` / `.typo-medium` |
| `bg-slate-700`（primitive 直参照） | semantic ロール（`bg-fg-middle` 等） |
| `typo-large` 以上で weight を bold 未満に下げる | デフォルトの bold のまま使う |
| 理由なく `sm` / `lg` サイズを選ぶ | 例外を除き `md` をデフォルトに |
| 独自ブランド色（青系等）の持ち込み | primary（緑）/ secondary（黄）+ ステータス色 |
| `is-selected` 等の状態クラス | `aria-selected="true"` 等の ARIA 属性 |
| 単一選択（1 つ選ぶと他が外れる）の切替に `.filter-chip` を並べる・`<a class="filter-chip">` でリンクにする・`aria-pressed` と `aria-current` の併用 | 一覧を 1 つの軸で絞り込む単一選択は `.tab`（`tabs-line` + `.tab-count`）、表示形式（一覧 / グリッド等）の切替は `.toggle-btn-group`（`data-selection="single"`）、フォームの単一選択は radio / `.select`。`.filter-chip` は `<button>` の複数同時選択トグル専用 |
| テキストリンク（a 要素）の下線省略・hover 時のみ下線 | 常に下線。省略はボタン形状・アイコンボタン・メニュー項目等「テキストリンクに見えない見た目」を意図的に選んだ場合のみ |
| テキストリンクを素の `<a>`・独自クラス（`.text-link` 等）・`underline text-primary-700` の直付けで自作 | 置き場所を問わず `.link` + `.link-label`（補助は `.link-neutral`、暗い背景は `.link-inverse`）。ボタン形状の主導線は a + `.btn`、ナビ項目は `.menu-item` |
| フォーカスリングの色変更（primary 緑など）・祖先の `overflow-hidden` での見切れ | info 青（`--shadow-focus-ring` / `outline-info-600`）のまま全周表示。角丸コンテナは `overflow-hidden` に頼らず first/last 子側で角丸を作る |
| 恒常的な surface の elevation をシャドウで表現（`card-elevated` の常用等） | ボーダー + 背景色で区切る。シャドウは modal / tooltip 等の重なりレイヤーのみ |
| テーブルの全列に `w-*` を配る・全セルに `whitespace-nowrap`・列幅や文字を詰めて 1 画面に収める | 締める列だけ `.data-table-fit` / `.data-table-num`、自由文は `.data-table-text` の 1 列に余白を渡す。収まらない幅は `.data-table-wrap` で横スクロール |
| コンテナ幅をサイズ名で新規指定（`max-w-5xl` 等） | 用途名の `max-w-page` / `max-w-content` / `max-w-article`（または `.page-shell` / `.page-shell-content`） |
| main へ直 push | feature branch + PR |

### ハードコードを許容する例外

上記は原則。以下のケースに限りハードコードを許容する（いずれもコメントで由来を明記）:

| 状況 | 例 | 理由 |
|---|---|---|
| Figma 由来の **bespoke カラー** がパレットに無い | hero gradient `#d9ebea` / `#e7f6f6` | 1 箇所限定の装飾色。トークン化するほどではない。コメントで由来を明記 |
| Figma 仕様で **off-scale な余白** が出る | (例) コンポーネント内 7px パディング | 該当パーツで本当に必要なら raw 値 OK。ただしコメントで「Figma 仕様」と明記 |
| **比率・100% / auto** | `width: 50%` `height: auto` `inset: 0` | スケール非依存値はそのまま |
| **強制カラーモードのシステムカラー** | `@media (forced-colors: active)` 内の `Highlight` / `CanvasText` / `GrayText` 等 | 強制カラー対応の正式な指定方法。トークンやブランド色ではなく OS の設定に追従する系統色なので、この用途に限り直書き可 |

---

## グローバル設定

| 設定 | 値 |
|---|---|
| カラーモード | ライトのみ (ダークモード対応は将来検討) |
| Primary | `#30b686` (brand-green-500) / hover `#1b805e` (600) |
| Font | Noto Sans JP + system fallbacks |
| Icon | Lucide subset 58 icons (SVG sprite) |
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
