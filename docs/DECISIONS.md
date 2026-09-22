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

## a 要素のテキストリンクは「コンポーネント」— 別名索引と自作検知で到達させる（2026-09）

- **背景**: 利用側プロダクトで、テキストリンクが `.link` でなく独自クラスで実装された。原因は誘導の穴が 4 つ重なったこと — (1) `search("テキストリンク")` が link を返さない（link.css は「リンクテキスト」「インラインリンク」としか書いておらず、タイトル行の和名も build-mcp が拾えず `nameJa: null`）、(2) DESIGN.md が「Link (本文中)」と場所を限定し、フッター・フォーム脇の脇役リンクが対象外に読めた、(3) MCP のハード制約・実装フローに「a 要素もコンポーネント」の言及がなく、エージェントは `<a>` を素の HTML と見なして get_component を引かなかった、(4) hook・evals に自作リンクの検知がなかった（article-links はリンクが主題の場面のみ）
- **判断**: ヘッダに任意の `別名:` ブロックを追加し、build-mcp が `aliases` として索引化、`search` / `get_component` / `list_components` で参照する。DESIGN.md・MCP 指示は「置き場所を問わず a 要素のテキストリンクは `.link`」と明文化。hook（`checkAnchors`）と capability お題 `login-form-links` に同じ判定基準の自作検知を置く
- **原則**: 「HTML 要素そのものに見える UI（a / select / table）もコンポーネント」。利用者の語彙（テキストリンク）と DS の語彙（リンクテキスト）がずれるときは、DS 側が別名で受ける — 利用者に DS の語彙を覚えさせない
- **検知基準**: relay のアンカー系クラス（link / btn / menu-item / pagination-item / breadcrumb / tab / sr-only）が無い `<a>` のうち、(a) class に `underline` / `text-色` / `hover:` を直付けしたもの、(b) "link" を含む独自クラス（`.text-link` / `.footer-link` / `.link-primary` 等。DS の link / link-neutral / link-inverse / link-label 以外）を持つもの。hook はさらに (c) その独自リンククラスに `color` / `text-decoration` を書く CSS 規則も検知する。素の `<a>`（ロゴ・画像・カード全体リンク）は対象外

## テーブルの列幅は「締める列だけ指定」— data-table に fit / num / text / wrap を用意（2026-09）

- **背景**: 利用側プロダクトで、テーブルの列幅が適切に設定されずレイアウト崩れが頻発した。典型は (1) 全列に `w-1/4` 等を配って合計が崩れる、(2) 全セルに `whitespace-nowrap` を付けて親幅を突き抜ける、(3) 状態バッジ・日付・金額の列が幅指定なしで自由文に押されて 2 行に折れる、(4) 列幅や文字を詰めて 1 画面に収めようとして読めなくなる。DS 側は `width:100%` の auto layout を返すだけで列幅の指針がなく、`min-w-*` の数値ユーティリティも safelist 外だったため、エージェントは任意値やインライン width に流れていた。get_component("data-table") にはコピペ用スニペットも無かった
- **判断**: data-table に 4 クラスを追加する。`.data-table-fit`（width:1% + nowrap で内容幅に締める。th と同列の td 全てに付ける）、`.data-table-num`（fit ＋ 右寄せ ＋ tabular-nums）、`.data-table-text`（自由文。::after の幅 0 高スペーサーで最小幅 256px を担保し、数文字幅に潰れない。td の min-width はブラウザ差があるため使わない）、`.data-table-wrap`（overflow-x:auto の受け皿。`tabindex="0"` でキーボード到達。wrap 内では自由文以外のセルを `word-break: keep-all` にして CJK の 1 文字折りを止め、表の最小幅を中身で決める。thead th は常に keep-all）。幅を指定するのは「締める列」だけで、残り 1 列が余白を吸う。収まらない幅は横スクロールで受け、列幅を詰めて収めない（本体サイトのクッキーポリシー表で「列幅を調整して収める → 自然な列幅のまま横スクロール」に方針転換した `1b053fd47` と同じ判断）
- **原則**: 利用側に数値を選ばせない。min-width や幅の実値は DS 側のクラスに閉じ込め、利用側は「この列は固定書式か自由文か」だけを判断する
- **同時に**: snippets/data-table.html・simple-table.html を新設（get_component がスニペットを返す）、DESIGN.md に Data Table 行と禁止パターン、カタログに列幅の実例、capability お題 `wide-table` を追加

## 単一選択の切替に filter-chip を並べない — 「1 つ選ぶと他が外れる」の行き先を tab / radio に明記（2026-09）

- **背景**: 利用側プロダクトの管理画面で、「有望 / 意欲が高い / 直近の問い合わせ / 休眠から再訪 …」から 1 つを選んで会員一覧を切り替える単一選択の絞り込みに `filter-chip` が並べられた。実装は `<a class="filter-chip" href="#…">` に `aria-pressed` と `aria-current="page"` を併記したもので、(1) 複数選べるように見える形で 1 つしか選べない、(2) button 専用のトグルを a 要素に流用、(3) 押下状態と現在地を二重に表す、の 3 点で DS の意図から外れていた。filter-chip ヘッダの NG は「単一選択しか許さない設問 → radio」とフォーム前提で書かれており、「一覧の表示を件数付きで切り替える」場面を受ける行き先が無かった。tab ヘッダも「一覧の表示形式」の切替としか書いておらず、絞り込み軸の切替が tab の領分だと読めなかった
- **判断**: コンポーネントは増やさない。見分け方を「1 つ選ぶと他が外れるなら filter-chip ではない」に統一し、行き先を用途で分ける — 同じ一覧を 1 つの軸で切り替える（件数付き）= `tab`（tabs-line + tab-count、一覧の領域が tabpanel）/ フォームの入力値としての単一選択 = `radio`（多ければ `select`）/ 複数同時選択の絞り込み = `filter-chip`。filter-chip ヘッダに `<a>` 流用と `aria-current` 併用の NG、tab ヘッダに単一選択の絞り込み切替の OK と複数選択の NG、DESIGN.md に Components 行の注記と禁止パターン行、capability お題 `single-select-filter` を追加
- **選ばなかった案**: filter-chip に単一選択 variant（radio 風チップ）を足す → 同じ形で「何個選べるか」が分岐し、ヘッダが既に禁じている「チップ形状で選択数の直感が崩れる」問題を DS 自身が作る。tab（line）は既に件数表示を持ち、見た目も横並びの切替として成立している
- **原則**: 見た目（件数付きの横並びチップ）ではなく選択モデル（排他か独立か）でコンポーネントを選ぶ。利用者が「チップに見えるから filter-chip」と引いたときに、ヘッダの最初の行で排他かどうかを問い直させる
