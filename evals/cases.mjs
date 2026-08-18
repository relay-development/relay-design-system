/*
 * evals/cases.mjs — eval のお題定義（正本）
 *
 *   エージェントが relay DS のルールに従えるかを測る固定のお題。
 *   プロンプトは**意図レベル**で書き、コンポーネント名を含めないこと
 *   （名指しすると「DS が選定を導けているか」を測れなくなる）。
 *
 * 各フィールド:
 *   id           — 出力ファイル名（evals/output/<id>.html）
 *   prompt       — エージェントに渡す要件（意図レベル）
 *   mustClasses  — 生成物に必須の relay クラス（機械チェック・Phase 1）
 *   mustPatterns — 生成物に必須の正規表現（機械チェック・Phase 1）
 *   rubric       — LLM 審査員の採点項目（Phase 2 で使用。定義のみ先行）
 *
 * お題の追加元（2 系統）:
 *   1. 実運用の失敗 — 本体サイトのリプレイス等で実際に AI がやらかした失敗を
 *      一般化して追加する（机上で発明しない）。出典はお題のコメントに書く。
 *      対象は「DS の知識で防げたはずの違反」のみ — チーム判断・プロダクト固有の
 *      決定はお題にしない（それは期待側の問題であり DS では防げない）。
 *   2. アクセシビリティの責任境界 — docs/ACCESSIBILITY.md の DS マーカーのうち
 *      ⚠️（DS+プロダクト共同）/ 🔧（プロダクト側）がエージェントの責務 =
 *      rubric / mustPatterns の導出元。✅（DS 完全担保）は mustClasses で
 *      「そのコンポーネントを使ったか」だけ守れば十分（保証はクラス使用が前提）。
 *      お題が使うコンポーネントの get_component「アクセシビリティ」節も併読する。
 */

/*
 * 全お題共通の機械チェック（run.mjs が各お題の mustPatterns に自動で合算する）。
 * 責任境界の ⚠️/🔧 のうち「どの UI でも成立し、正規表現で測れるもの」だけを置く。
 * forbid: true は「マッチしたら不合格」（アンチパターン検知）。
 */
export const COMMON_PATTERNS = [
  { pattern: "<html[^>]*\\slang=", label: "html に lang 指定（WCAG 3.1.1）" },
  { pattern: "<img\\b(?![^>]*\\balt=)", forbid: true, label: "alt なしの img（WCAG 1.1.1。装飾なら alt=\"\"）" },
  {
    pattern: "<svg(?![^>]*\\b(aria-hidden|aria-label|aria-labelledby|role)=)",
    forbid: true,
    label: "a11y 属性なしの svg（装飾は aria-hidden=\"true\"、意味があるなら aria-label。WCAG 1.1.1）",
  },
];

export const CASES = [
  {
    id: "delete-confirmation",
    prompt:
      "メンバー一覧のページに、メンバーのアカウントを削除する操作を追加してください。誤操作で消えると取り返しがつかないので、削除の前にひと呼吸置ける UI にしてください。",
    mustClasses: ["modal", "btn-negative"],
    mustPatterns: [{ pattern: "<dialog", label: "ネイティブ <dialog> ベース（modal の正本仕様）" }],
    rubric: [
      "確認 UI に modal を使っている（alert・独自オーバーレイの手書きではない）",
      "削除の実行ボタンは btn-negative。primary（ブランド緑）を破壊的操作に使っていない",
      "キャンセルの逃げ道が明確にある（キャンセルボタン等）",
      "確認文言が何を削除するのか具体的に伝えている",
    ],
  },
  {
    id: "invite-form",
    prompt:
      "メンバーを招待するフォームを作ってください。入力項目は、メールアドレス（必須）、役割の選択（管理者・編集者・閲覧者から 1 つ）、補足メモ（任意）の 3 つです。",
    mustClasses: ["label-control", "input", "btn-primary"],
    mustPatterns: [],
    rubric: [
      "各入力項目に label-control を使い、必須/任意をバッジで示している",
      "役割の選択に select または selector を使っている（ラジオでも可だが自作ドロップダウンは不可）",
      "送信ボタンは btn-primary が 1 つだけ（primary は 1 画面 1 つの原則）",
      "補足文のタイポグラフィが typo-small に逃げず可読性を保っている",
    ],
  },
  {
    id: "status-table",
    prompt:
      "契約の一覧を確認できる画面を作ってください。各契約について、契約名・取引先・金額と、状態（有効 / 期限切れ / 審査中）が一目で分かるようにしてください。",
    mustClasses: ["data-table", "badge"],
    mustPatterns: [],
    rubric: [
      "一覧に data-table を使っている（table 要素の手書きスタイリングではない）",
      "状態表示に badge を使い、状態ごとに意味の合うステータス色を使い分けている（有効=success / 期限切れ=danger。審査中は warning / info どちらも可。全状態に同じ色を使うのは不可）",
      "状態が色だけでなくテキストでも伝わる",
      "金額など数値の桁揃えに配慮している",
    ],
  },
  {
    // 2026-08-18 更新: 実運用でブランドアセット（list_assets）が一切使われない問題から、
    // 親しみやすさの要件を追加し「イラスト = 公式アセット」を必須化（独自 SVG を描かせない）
    id: "empty-state",
    prompt:
      "プロジェクト一覧のページで、まだプロジェクトが 1 件もないときに表示する画面を作ってください。ユーザーが次に何をすればいいか迷わないように、そしてそっけない画面にならないよう、サービスの親しみやすさが伝わる見た目にしてください。",
    mustClasses: ["btn"],
    mustPatterns: [
      {
        pattern: "raw\\.githubusercontent\\.com/relay-development/relay-design-system/main/examples/assets/",
        label: "イラストは公式ブランドアセット（list_assets の直リンク URL）を使う",
      },
    ],
    rubric: [
      "最初のアクション（プロジェクト作成）が btn-primary で明確に示されている",
      "見出し・説明文に typo-* のセマンティック階層を使っている",
      "テキスト色は fg-{high,middle,low} ロールを使っている（neutral-* 直指定でない）",
      "視覚要素はブランドアセットのイラスト（list_assets）で、独自の SVG イラストを描いていない",
      "装飾過多でない（AI スロップ的な過剰イラスト・グラデーションがない。アセット 1 点で十分）",
    ],
  },
  {
    id: "settings-nav",
    prompt:
      "設定画面に、プロフィール・通知・セキュリティの 3 セクションを行き来できるナビゲーションを付けてください。いま自分がどのセクションにいるかが分かるようにしてください。",
    mustClasses: ["menu", "menu-item"],
    mustPatterns: [{ pattern: 'aria-current="page"', label: "現在地は aria-current（独自 is-* クラスでない）" }],
    rubric: [
      "ナビゲーションに menu を使っている（独自のリスト+ハイライトの手書きではない）",
      "現在地の表現が aria-current で、is-active 等の独自状態クラスを使っていない",
      "セクション間の遷移がリンク（a 要素）で、button を遷移に流用していない",
    ],
  },
  // ---- 以下は本体サイトのリプレイス作業（2026-08）で実際に起きた失敗の一般化 ----
  // 出典の詳細: evals/ds-replace-first-vs-final.md（ローカル専用・コミットしない）
  {
    // 出典: Q&A を details/summary + 独自 CSS で自作し、後から accordion に置換された
    id: "faq-accordion",
    prompt:
      "サービスの「よくある質問」セクションを作ってください。質問を 6 件ほど載せ、回答は最初は閉じておき、質問を押すと開くようにしてください。",
    mustClasses: ["accordion", "accordion-item", "accordion-trigger"],
    mustPatterns: [
      { pattern: "<details", label: "ネイティブ <details> ベース（accordion の正本仕様。独自 JS 開閉でない）" },
    ],
    rubric: [
      "開閉 UI に accordion を使っている（details/summary への独自 CSS や独自 JS の自作ではない）",
      "トリガーが summary（accordion-trigger）で、div の onclick 等キーボード操作できない自作トリガーでない",
      "開閉アイコン（chevron）が見出しの左にある（右端だけに置いていない）",
      "is-open 等の独自状態クラスを発明していない（開閉状態は details の open に任せる）",
    ],
  },
  {
    // 出典: 絞り込みが select/checkbox の change で自動送信になっていて WCAG 3.2.2 で作り直し。
    //       select がアクセシブルネームなし（placeholder 頼み）で後追い修正
    id: "listing-filter",
    prompt:
      "物件一覧のページに、エリア（都道府県から 1 つ選択）と種別（売買・賃貸から複数選択可）で絞り込める UI を付けてください。",
    mustClasses: ["select", "checkbox", "btn"],
    mustPatterns: [],
    rubric: [
      "絞り込みの実行が明示的なボタンで行われ、select / checkbox の change で自動送信・自動リロードする作りになっていない（WCAG 3.2.2）",
      "select にアクセシブルネームがある（label の関連付け or aria-label。placeholder 頼みにしない）",
      "チェックボックスに checkbox コンポーネントを使い、label がクリック可能に関連付いている（for/id または包含）",
    ],
  },
  {
    // 出典: 「テキストリンクは常に下線」原則の適用が揺れた（ナビは menu-item 例外、本文は下線必須）
    id: "article-links",
    prompt:
      "事業承継の基礎を解説する記事の本文セクションを作ってください。本文の途中で、関連する 2 つの解説記事へ読者を誘導してください。",
    mustClasses: ["link", "typo-article"],
    mustPatterns: [],
    rubric: [
      "関連記事への誘導が a 要素のテキストリンク（link）で、下線が常時ある（下線を消す・hover 時のみ下線にする細工をしていない）",
      "遷移に button を流用していない",
      "記事本文が typo-article を使い、text-fg-high とセットになっている",
      "見出しに typo-* のセマンティック階層を使っている",
    ],
  },
];
