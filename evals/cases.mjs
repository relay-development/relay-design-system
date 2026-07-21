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
 */

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
      "状態表示に badge を使い、意味に合う色（有効=success / 期限切れ=danger / 審査中=warning）を割り当てている",
      "状態が色だけでなくテキストでも伝わる",
      "金額など数値の桁揃えに配慮している",
    ],
  },
  {
    id: "empty-state",
    prompt:
      "プロジェクト一覧のページで、まだプロジェクトが 1 件もないときに表示する画面を作ってください。ユーザーが次に何をすればいいか迷わないようにしてください。",
    mustClasses: ["btn"],
    mustPatterns: [],
    rubric: [
      "最初のアクション（プロジェクト作成）が btn-primary で明確に示されている",
      "見出し・説明文に typo-* のセマンティック階層を使っている",
      "テキスト色は fg-{high,middle,low} ロールを使っている（neutral-* 直指定でない）",
      "装飾過多でない（AI スロップ的な過剰なイラスト・グラデーションがない）",
    ],
  },
  {
    id: "settings-nav",
    prompt:
      "設定画面に、プロフィール・通知・セキュリティの 3 セクションを行き来できるナビゲーションを付けてください。いま自分がどのセクションにいるかが分かるようにしてください。",
    mustClasses: ["sidenav", "sidenav-item"],
    mustPatterns: [{ pattern: 'aria-current="page"', label: "現在地は aria-current（独自 is-* クラスでない）" }],
    rubric: [
      "ナビゲーションに sidenav を使っている（独自のリスト+ハイライトの手書きではない）",
      "現在地の表現が aria-current で、is-active 等の独自状態クラスを使っていない",
      "セクション間の遷移がリンク（a 要素）で、button を遷移に流用していない",
    ],
  },
];
