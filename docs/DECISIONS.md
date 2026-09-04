# 過去の設計判断（Architecture Decision Records）

> ルールとして [DESIGN.md](../DESIGN.md) の Non-Negotiable Principles に昇格した項目（typo セマンティック層 / ARIA 状態 / Blessed Scale 等）は本ファイルには含めない。ここに残るのは **歴史的経緯** や **デザインシステム内部の実装判断**。

## アイコン: Lucide subset を SVG sprite として同梱

`scripts/build-icons.mjs` → `dist/icons.svg`。JS 依存ゼロで vanilla HTML から `<use href="...#lucide-x">` で使える。

## Spacing: Tailwind single-base

`--spacing: 0.25rem` で全 `p-*` / `m-*` を自動派生。`--spacing-0..16` 等の名前付きトークンは追加しない（Tailwind v4 の流儀に合わせる）。

## カタログ用 hover / focus プレビュー

`.is-hover-preview` / `.is-focus-preview` modifier を CSS 側で `:hover` / `:focus-visible` と OR 条件にする。カタログで全状態を静的に可視化するため。

## プレビューサイトのホスティング: Netlify → GitHub Pages

Netlify のクレジット上限超過のため移行済み。GitHub Pages は public repo + Free プランで容量無制限。

## MCP サーバーは既存パッケージに同梱

- `bin: relay-ds-mcp` → `dist/mcp.mjs`
- `@modelcontextprotocol/sdk` は **esbuild でバンドル**して単一ファイル化し devDependency に留める（CSS だけ使う利用者に runtime 依存を増やさない）
- コンテンツは二重管理せず `scripts/build-mcp.mjs` が正本ファイルから `dist/mcp-index.json` を生成 → server にインライン
- **`get_component` の品質は `src/components/*.css` 先頭のヘッダコメント形式（`recreated from Figma component set NNNN:NNNN (和名)` + props + Usage）に依存する**ので、新規コンポーネントでも雛形を必ず踏襲する（ヘッダが無いと doc が空になる）
- （追記）その後、npm 不要のリモート版（authless / Streamable HTTP）を Cloudflare Workers にも展開（`src/mcp/worker.mjs`、`npm run deploy:mcp`）。stdio 版と `handlers.mjs` を共有し、コンテンツの正本は変わらず `dist/mcp-index.json`

## コンポーネントの「機能」「使用法(OK/NG)」も CSS ヘッダが正本

- ヘッダに `機能:`（用途・代替コンポーネントとの使い分け）と `使用法:`（`OK:` / `NG:` で始まる行）ブロックを書くと、`build-mcp.mjs` が `function` / `usage{ok,ng}` フィールドに抽出し `get_component` がクラスより前に表示する
- さらに `build-pages.mjs` が `dist/mcp-index.json` を読み、カタログ fragment 内の `<!-- usage:auto:<name> -->` マーカーを「機能・使用法」カードに置換する（人間向け表示も同じ正本から自動生成・二重管理なし）
- **この自動注入のため `dev` / `build:site` は `build:pages` の前に `build:mcp-index` を実行する**（順序を崩さない）
- ブロックの**どの行にも `*/` を書かない**（CSS ブロックコメントが閉じてしまう／ヘッダが途中で切れる）
- `使用法:` があるのに `OK:` / `NG:` 行が無いと build-mcp が warn を出す

## 正本の反転: コードが正本、Figma はデザイン探求の場（2026-07）

当初は Figma を正本とし、片方向（Figma → コード）同期を原則としていたが、UI 実装の主体が AI エージェント（Claude Code / Cursor 等）に移り、エージェントが参照するのはコード・MCP・DESIGN.md である実態に合わせて反転した。

- **正本**: このリポジトリのコード（`src/tokens/` / `src/components/*.css` ヘッダ / DESIGN.md）
- **Figma の役割**: 新しいコンポーネント・画面のデザイン探求。固まったデザインをコードに取り込んだ時点で正式版になる
- Figma への書き戻し・継続同期は行わない（必要になれば都度判断）
- コンポーネント CSS ヘッダの `recreated from Figma component set NNNN:NNNN` 表記は出自の記録として維持する（build-mcp のパースにも使用しているため書式を変えない）

## sprint kit の解体 — 配布は hook 単体へ縮小（2026-08）

スプリント開発キット（planner / generator / evaluator subagent + sprint workflow + hardcode gate hook）の MCP 配布（`get_sprint_kit` ツール・`relay://skill/sprint` リソース・`sprint` プロンプト）を廃止した。

- **理由**: キット一式の導入は利用側にとって重く、実際に届けたい価値の大半は「書いた瞬間にハードコードを弾く」hook にあった。知識（instructions・ヘッダ・get_accessibility 等）は MCP 接続だけで全員に届くのに対し、キットは能動的な一式インストールを要求し、導入率が上がらない
- **後継**: hardcode gate hook のみ `get_setup` のセットアップ手順で単体導入を案内する（raw URL から取得 + settings.json への hooks 追記の 2 手順）。正本は `.claude/hooks/relay-hardcode-gate.mjs` のまま
- **ローカルは維持**: `.claude/agents/` / `.claude/workflows/` はこのリポジトリ自身の開発（planner / generator / evaluator subagent と sprint workflow）で引き続き使う。配布をやめただけで、ファイルと運用は残る
- 復活させる場合は index への同梱（build-mcp の buildSprintKit）とツール/リソース/プロンプト定義を git 履歴から戻す

## search はクラスの「不在」を明言し、複数クラスを一括判定する（2026-09）

#266 で search がクラス存在に答えるようにしたが、evals の行動ログで次の逃避が観測された（status-table 2026-09-02）。

- `search("tabular-nums")` が「ヒットなし」と返る → 否定が曖昧なため AI は search を信用せず、実 CSS の grep に切り替えた
- 確認したいユーティリティが 30 個超あり、1 件ずつ search するより grep ループの方が速いと判断した → Bash ガード（for ループ拒否・複数操作は承認要）とミニファイ CSS（1 行なので `grep -n` が全文を返す）に阻まれ、20 回中 7 回が空振り

対応:

- クラス形のクエリで見つからなければ「relay.css に存在しません（書いても効かない）」と明言する（「ヒットなし」への誘導文は出さない）
- 空白・カンマ区切りで複数渡されたら件ごとの ○× 表を 1 回で返す（一括判定の条件は全トークンが実在クラスか `-` / `:` を含むこと。英単語 2 語のあいまい検索を巻き込まない）
- get_setup §6 に「relay.css はミニファイ済みで grep は存在確認に使えない。確認は search で」を明記
- 効果測定は `npm run eval` の前後比較（grep(relay.css) 数・Bash 数・search 数）で行う。1 回同士の比較は生成ブレが大きいので `--trials 2` 以上で見る

## select / selector の統合 — ネイティブ select の正本クラスは `.select`（2026-09）

`select`（単体・枠 stroke/high・14px）と `selector`（wrapper・枠 neutral/400・16px・Figma 由来）が
同じネイティブ select の 2 系統として並存し、見た目も中のクラス名（`.select` / `.selector-field`）も
揺れていた。evals（listing-filter 2026-09-03）では都道府県の単一選択に `.select` を使った正しい
生成物が、必須クラス `selector-field` の機械チェックで落ちた（#262 が「select は実在しない
クラス」と誤認して必須クラスを書き換えていたのが直接原因）。

- **正本**: ネイティブ `<select>` のクラスは単体でも selector 内でも `class="select"` の 1 つ
- **見た目**: `.select` 単体は Figma 由来の selector-md に揃える（枠 neutral/400、16/24、h 40、
  hover neutral/500、error 2px negative/500、placeholder は text/placeholder）
- **selector**: wrapper のまま。中の `.select` に対して枠・背景シェブロン・padding を無効化し、
  枠・シェブロン・サイズ・アイコン枠を wrapper が引き受ける（CSS は `:is(.select, .selector-field)`）
- **非推奨**: `.selector-field` はエイリアスとして残す（minor で導入、次の major で削除）
- **選ばなかった案**: 見た目だけ揃えてクラスを 2 つ残す → エージェントの select / selector-field
  の揺れが解消しない。selector を廃止 → アイコン枠を失い Figma との対応が切れる

## Tailwind の自動ソース検出を止める — dist に入るクラスは @source で明示（2026-09）

`@import "tailwindcss"` の既定は .gitignore 外の全ファイルをコンテンツとして走査するため、
docs / README / `src/mcp/handlers.mjs` の文章中に書いたクラス名がそのまま utility として
dist/relay.css に生成されていた。#271 で get_setup の例文に書いた `tabular-nums`、禁止例として
書いた `p-[13px]` まで dist に入り、「relay.css に存在するクラス」の集合が文書の書き方に
左右される状態だった（search の「存在しません」の検証が例文を書いた瞬間に崩れる）。

- `@import "tailwindcss" source(none)` にし、走査対象を `@source`（examples / snippets）と
  `@source inline(...)` の safelist だけにする
- 切り替えで消えるクラスは 11 件。うち `outline-info-600` / `shadow-focus-ring` /
  `shadow-destructive` / `transition-colors` / `transition-opacity` / `duration-150` は
  DESIGN.md・ACCESSIBILITY.md が利用側に案内しているため明示 safelist に移した
- `blur` / `container` / `w-1` / `p-[13px]` / `tabular-nums` は文書・エージェント定義の文中から
  偶然拾われていただけなので落とした（`tabular-nums` は金額の桁揃え用に意図して足す候補。
  足すなら safelist に書き、search の例文も差し替える）
- 以後、utility を dist に足したいときは index.css の safelist に書く。文書に書いても入らない

## アイコンは get_icon で symbol を配る — スプライト前提と単一 HTML の矛盾を解く（2026-09）

icon の仕様は Lucide スプライト（dist/icons.svg）を `<use href="…icons.svg#id">` で参照する前提だったが、
外部 `.svg#id` 参照は file:// で開いた文書では描かれない。evals の生成物（単一 HTML）はこの制約下に
あるため、ハードコード hook とお題指示は「外部スプライト参照禁止・inline symbol にせよ」としていた。
結果、エージェントは仕様に従えず、dist/icons.svg を grep して symbol を掘り出すか SVG パスを自作していた
（2026-09-03: settings-nav / faq-accordion が Bash 6〜7 回、`.icon` にサイズクラスを付けず 300×150px に崩れる例も）。

- **正本は変えない**: スプライトが DS の配布形。仕様に「参照できない環境では symbol を文書内に定義する」
  書き方を正式な使い方 B として追加し、両方で同じ class（icon + icon-{size}）を使うと明記
- **MCP に get_icon を追加**: build-mcp が dist/icons.svg から 53 symbol を index に載せ、get_icon(name) が
  A（スプライト参照）と B（inline 定義）の markup を返す。name 省略で一覧、未同梱なら近い名前を返し自作を止める。
  search にアイコン名を渡しても get_icon へ誘導する
- **ハーネス**: お題指示を「get_icon で symbol を取得して inline」に書き換え。hook の外部スプライト禁止は
  file:// 表示の都合なので維持（評価環境固有のルールであり、利用側プロジェクトには適用されない）
- **ヘッダ**: icon.css に「サイズクラス必須（省くと 300×150px）」と使い方 B を追記（filter-chip の巨大チェックと同根）

