/*
 * Catalog interaction scripts — shared across all preview pages.
 * Every handler is delegated / selector-guarded, so loading this on a page
 * that lacks the target elements is a harmless no-op.
 * Edit here — build-pages.mjs links it on every generated page.
 *
 * (The old in-page sidebar scroll-spy was dropped: navigation is now
 *  page-to-page, and the active link is marked at build time via
 *  aria-current="page" by build-pages.mjs.)
 */

// Search Input — clear (×) button clears the field in the same container.
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".search-input-clear");
  if (!btn) return;
  const field = btn.closest(".search-input")?.querySelector(".search-input-field");
  if (field) {
    field.value = "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  }
});

// Checkbox — set indeterminate via [data-indeterminate] attribute
// (HTML has no static attribute for the indeterminate state).
document
  .querySelectorAll('input[type="checkbox"][data-indeterminate]')
  .forEach((el) => {
    el.indeterminate = true;
  });

// Nested checkbox — parent reflects all/none/some children state, and
// clicking the parent toggles all enabled children at once.
document.querySelectorAll("[data-nested-checkbox]").forEach((group) => {
  const parent = group.querySelector("[data-nested-parent]");
  const children = group.querySelectorAll("[data-nested-child]");
  if (!parent || !children.length) return;

  const sync = () => {
    const active = [...children].filter((c) => !c.disabled);
    const checked = active.filter((c) => c.checked).length;
    if (checked === 0) {
      parent.checked = false;
      parent.indeterminate = false;
    } else if (checked === active.length) {
      parent.checked = true;
      parent.indeterminate = false;
    } else {
      parent.checked = false;
      parent.indeterminate = true;
    }
  };

  parent.addEventListener("change", () => {
    children.forEach((c) => {
      if (!c.disabled) c.checked = parent.checked;
    });
    parent.indeterminate = false;
  });
  children.forEach((c) => c.addEventListener("change", sync));
  sync();
});

// Textarea — character counter; "X/Y" on input, invalid styling past maxlength.
document.addEventListener("input", (e) => {
  const ta = e.target.closest(".textarea-control textarea");
  if (!ta) return;
  const root = ta.closest(".textarea-control");
  const counter = root?.querySelector(".textarea-counter");
  if (!counter) return;
  const max = parseInt(ta.getAttribute("maxlength") || root.dataset.counterMax || "0", 10);
  const len = ta.value.length;
  counter.textContent = max ? `${len}/${max}` : `${len}`;
  const overflow = max && len > max;
  counter.classList.toggle("is-invalid", overflow);
  root.classList.toggle("is-invalid", overflow);
  ta.classList.toggle("textarea-error", overflow);
});

// Filter Chip — toggle aria-pressed on click (disabled chips ignored).
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.disabled || chip.classList.contains("is-disabled")) return;
  const next = chip.getAttribute("aria-pressed") === "true" ? "false" : "true";
  chip.setAttribute("aria-pressed", next);
});

// Tabs — mutually exclusive selection within [data-tabgroup].
// aria-controls が指すパネルがあれば、選択タブのパネルだけ表示する（無ければ選択状態の切替のみ）。
// data-tab-param を持つグループは、選択タブを URL クエリ (?<param>=<key>) に反映し、
// リロード・共有・ブックマークでタブ状態を復元できるようにする。
// タブの key は data-tab-key、無ければ aria-controls の末尾セグメント
// （button-panel-guideline → "guideline"）。
const tabKey = (tab) =>
  tab.dataset.tabKey || (tab.getAttribute("aria-controls") || "").split("-").pop();

function selectTab(group, tab, updateUrl) {
  group.querySelectorAll(".tab").forEach((t) => {
    const selected = t === tab;
    t.setAttribute("aria-selected", selected ? "true" : "false");
    const panel = t.getAttribute("aria-controls") && document.getElementById(t.getAttribute("aria-controls"));
    if (panel) panel.toggleAttribute("hidden", !selected);
  });
  const param = group.dataset.tabParam;
  if (updateUrl && param) {
    const url = new URL(location.href);
    url.searchParams.set(param, tabKey(tab));
    history.replaceState(null, "", url);
  }
}

document.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab || tab.disabled) return;
  const group = tab.closest("[data-tabgroup]");
  if (!group) return;
  selectTab(group, tab, true);
});

// 初期表示: URL クエリからタブを復元（該当グループのみ・不一致なら既定のまま）。
document.querySelectorAll("[data-tabgroup][data-tab-param]").forEach((group) => {
  const key = new URL(location.href).searchParams.get(group.dataset.tabParam);
  if (!key) return;
  const tab = [...group.querySelectorAll(".tab")].find((t) => tabKey(t) === key);
  if (tab) selectTab(group, tab, false);
});

// Modal — data-modal-open="<dialog id>" で showModal()、data-modal-close で閉じる。
// backdrop (dialog 自身の外側) クリックでも閉じる。Esc はネイティブ <dialog> が処理。
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-modal-open]");
  if (opener) {
    document.getElementById(opener.dataset.modalOpen)?.showModal();
    return;
  }
  if (e.target.closest("[data-modal-close]")) {
    e.target.closest("dialog")?.close();
    return;
  }
  // backdrop クリック判定: クリック座標が dialog の矩形外なら閉じる
  if (e.target instanceof HTMLDialogElement && e.target.classList.contains("modal") && e.target.open) {
    const r = e.target.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) e.target.close();
  }
});

// Sidebar accordion — Foundations / Components の開閉状態を localStorage に
// 保存し、ページ遷移後も引き継ぐ (MPA のため DOM 状態は毎回リセットされる)。
document.querySelectorAll("details[data-nav-group]").forEach((d) => {
  const key = `sidebar-group-open:${d.dataset.navGroup}`;
  const saved = localStorage.getItem(key);
  if (saved !== null) d.open = saved === "1";
  d.addEventListener("toggle", () => localStorage.setItem(key, d.open ? "1" : "0"));
});

// Color swatch — 色の丸クリックでカラーコードをクリップボードにコピー。
// data-tip 末尾のコード (#hex / rgba) を抜き出し、ツールチップで完了を知らせる。
document.addEventListener("click", async (e) => {
  const cell = e.target.closest(".status-cell[data-tip]");
  if (!cell) return;
  const original = cell.dataset.tip;
  const code = original.split("\u00b7").pop().trim();
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    return;   // クリップボード未許可 (非 HTTPS 等) は何もしない
  }
  cell.dataset.tip = `${code} をコピーしました \u2713`;
  setTimeout(() => {
    cell.dataset.tip = original;
  }, 1200);
});

// Token swatch — token-list の色見本クリックでもカラーコードをコピー。
// hex が DOM に無い行 (テキスト系) もあるため、描画色 (computed style) から取得する。
const rgbToCode = (rgb) => {
  const m = rgb.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgb;
  const [r, g, b, a] = m[1].split(",").map((v) => parseFloat(v));
  const hex = "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return a !== undefined && a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : hex;
};

document.addEventListener("click", async (e) => {
  const sw = e.target.closest(".token-row .swatch");
  if (!sw) return;
  // 枠線が本体のスウォッチ (境界線トークン等) は data-copy で明示指定
  const code = sw.dataset.copy || rgbToCode(getComputedStyle(sw).backgroundColor);
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    return;
  }
  // スウォッチの上に 1.2 秒だけ完了バブルを出す
  const r = sw.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "copy-bubble";
  bubble.textContent = `${code} をコピーしました \u2713`;
  bubble.style.left = `${r.left + r.width / 2}px`;
  bubble.style.top = `${r.top}px`;
  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1200);
});

// Menu — 矢印キーで項目間をフォーカス移動する（Tab に「加えた」操作。Tab 順は変えない）。
// ↑/↓ で前後の .menu-item、Home/End で先頭/末尾へ。端でループし、無効・非表示項目は飛ばす。
// roving tabindex は使わない（使うと Tab で 1 項目しか辿れなくなるため）。
document.addEventListener("keydown", (e) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const item = e.target.closest(".menu-item");
  if (!item) return;
  const scope = item.closest(".menu, .docs-sidebar-nav");
  if (!scope) return;
  const items = [...scope.querySelectorAll(".menu-item")].filter(
    (el) =>
      !el.disabled &&
      !el.classList.contains("is-disabled") &&
      el.offsetParent !== null, // 折り畳み中 (details 閉) / モバイル非表示は除外
  );
  const i = items.indexOf(item);
  if (items.length < 2 || i === -1) return;
  const target =
    e.key === "ArrowDown" ? items[(i + 1) % items.length]
    : e.key === "ArrowUp" ? items[(i - 1 + items.length) % items.length]
    : e.key === "Home" ? items[0]
    : items[items.length - 1];
  e.preventDefault(); // 矢印での画面スクロールを抑止
  target.focus();
});

// Mobile hamburger — サイドナビの開閉 (768px 以下で表示されるトグル)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".docs-sidebar-toggle");
  if (!btn) return;
  const sidebar = btn.closest(".docs-sidebar");
  const open = sidebar.classList.toggle("is-open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
});

// Copy button — [data-copy-target="<selector>"] で対象要素のテキストをコピー。
// ボタン内の [data-copy-label] テキストだけを一時的に差し替えて完了を知らせる
// (アイコンは保持)。色見本の data-copy とは属性名を分けて衝突を避ける。
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy-target]");
  if (!btn) return;
  const target = document.querySelector(btn.dataset.copyTarget);
  if (!target) return;
  try {
    await navigator.clipboard.writeText(target.textContent.trim());
  } catch {
    return;   // クリップボード未許可 (非 HTTPS 等) は何もしない
  }
  const label = btn.querySelector("[data-copy-label]") || btn;
  if (label.dataset.original === undefined) label.dataset.original = label.textContent;
  label.textContent = "コピーしました ✓";
  clearTimeout(btn._copyTimer);
  btn._copyTimer = setTimeout(() => {
    label.textContent = label.dataset.original;
  }, 1400);
});
