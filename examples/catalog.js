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

// Toggle Button Group — data-selection="single" は押したボタンだけを pressed にする
// （選択中を押し直しても外さない）。"multiple" は押したボタンの aria-pressed を反転する。
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-btn-group [aria-pressed]");
  if (!btn || btn.disabled) return;
  const group = btn.closest(".toggle-btn-group");
  if (group.dataset.selection === "single") {
    group.querySelectorAll("[aria-pressed]").forEach((b) => {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
  } else {
    btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") === "true" ? "false" : "true");
  }
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

// Sidebar accordion — 各グループの開閉状態を localStorage に
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

// Action Menu — 開閉は Popover API (popover + popovertarget) に任せ、APG Menu Button の操作を足す。
// トリガーの aria-expanded 同期 / 開いたら先頭項目へフォーカス / ↑↓ Home End で項目移動 /
// トリガー上の ↓↑ で開く / Tab で閉じて次へ / 項目選択で閉じる / 位置計算（下に空きが無ければ上へ）。
// Esc・外側クリックでの閉じ（light dismiss）と閉じた後のフォーカス復帰は Popover API が行う。
// toggle / beforetoggle はバブリングしないため capture で拾う。
const ACTION_MENU_GAP = 4;       // トリガーとの距離 (spacing 1)
const ACTION_MENU_VIEWPORT = 16; // 画面端から最低限空ける距離 (spacing 4)
const actionMenuTrigger = (menu) => document.querySelector(`[popovertarget="${menu.id}"]`);
const actionMenuItems = (menu) =>
  [...menu.querySelectorAll('[role="menuitem"]')].filter((el) => el.offsetParent !== null);

function positionActionMenu(menu) {
  const trigger = actionMenuTrigger(menu);
  if (!trigger) return;
  const r = trigger.getBoundingClientRect();
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  let left = menu.classList.contains("action-menu-end") ? r.right - w : r.left;
  left = Math.min(Math.max(left, ACTION_MENU_VIEWPORT), vw - w - ACTION_MENU_VIEWPORT);
  let top = r.bottom + ACTION_MENU_GAP;
  const above = r.top - ACTION_MENU_GAP - h;
  if (top + h > vh - ACTION_MENU_VIEWPORT && above >= ACTION_MENU_VIEWPORT) top = above;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

document.addEventListener("beforetoggle", (e) => {
  const menu = e.target;
  if (!(menu instanceof HTMLElement) || !menu.classList.contains("action-menu")) return;
  // 位置を計算するまで隠す (開いた瞬間に仮位置が一瞬見えるのを防ぐ)
  if (e.newState === "open") menu.style.visibility = "hidden";
}, true);

document.addEventListener("toggle", (e) => {
  const menu = e.target;
  if (!(menu instanceof HTMLElement) || !menu.classList.contains("action-menu")) return;
  const trigger = actionMenuTrigger(menu);
  const open = e.newState === "open";
  trigger?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    positionActionMenu(menu);
    menu.style.visibility = "";
    const items = actionMenuItems(menu);
    const focusLast = menu.dataset.focus === "last";
    delete menu.dataset.focus;
    (focusLast ? items[items.length - 1] : items[0])?.focus();
  } else if (trigger && (document.activeElement === document.body || menu.contains(document.activeElement))) {
    trigger.focus(); // フォーカス復帰の保険 (通常は Popover API が戻す)
  }
}, true);

document.addEventListener("keydown", (e) => {
  // トリガー上の ↓ / ↑ — 開いて先頭 / 末尾の項目へ
  const trigger = e.target.closest?.('[aria-haspopup="menu"][popovertarget]');
  if (trigger && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    const menu = document.getElementById(trigger.getAttribute("popovertarget"));
    if (!menu?.classList.contains("action-menu")) return;
    e.preventDefault();
    if (menu.matches(":popover-open")) {
      const items = actionMenuItems(menu);
      (e.key === "ArrowUp" ? items[items.length - 1] : items[0])?.focus();
    } else {
      menu.dataset.focus = e.key === "ArrowUp" ? "last" : "first";
      menu.showPopover();
    }
    return;
  }
  // メニュー内 — ↑↓ Home End で移動、Tab で閉じる (Esc は Popover API)
  const menu = e.target.closest?.(".action-menu:popover-open");
  if (!menu) return;
  if (e.key === "Tab") {
    menu.hidePopover(); // フォーカスはトリガーに戻り、既定の Tab でその次の要素へ進む
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = actionMenuItems(menu);
  const i = items.indexOf(document.activeElement);
  const target =
    e.key === "ArrowDown" ? items[(i + 1) % items.length]
    : e.key === "ArrowUp" ? items[(i - 1 + items.length) % items.length]
    : e.key === "Home" ? items[0]
    : items[items.length - 1];
  e.preventDefault();
  target?.focus();
});

document.addEventListener("click", (e) => {
  const item = e.target.closest('.action-menu [role="menuitem"]');
  if (!item) return;
  if (item.getAttribute("aria-disabled") === "true") return; // 無効項目は閉じない
  item.closest(".action-menu:popover-open")?.hidePopover();
});

// 開いている間にスクロール / リサイズしてもトリガーに追従させる
for (const type of ["scroll", "resize"]) {
  window.addEventListener(type, () => {
    document.querySelectorAll(".action-menu:popover-open, .data-table-filter-panel:popover-open").forEach(positionActionMenu);
  }, { passive: true, capture: true });
}

// Table filter — 列フィルター (data-table-filter)。開閉・Esc・外側クリックでの閉じは Popover API に任せ、
// aria-expanded 同期 / 位置計算 (action-menu と共通) / 開いたら select へフォーカス /
// 開くたびに適用中の値へ戻す (未適用の選択は捨てる) / 適用・リセットで行を絞り込み件数を告知 /
// Tab でパネルの外へ出たら閉じる、を足す。適用中の値はパネルの data-value に持ち、
// 同じ表の列フィルターは AND で掛け合わせる。セルの文字と option の値が一致した行を残す。
// 見出し行（data-table-header）の絞り込みパネルは data-filter-table で表を指し、条件ごとの select に
// data-filter-col（列番号）を持つ（data-filter-match="prefix" なら前方一致。適用中の値は select の data-applied）。
// 見出し行の検索（data-table-search）は、行の文字にキーワードを含む行を残す。いずれも列フィルターと AND。
// 検索は送信（虫眼鏡 / Enter）で確定したキーワード（入力欄の data-applied）で絞り込み、入力中の文字は使わない。
const filterTrigger = (panel) => document.querySelector(`[popovertarget="${panel.id}"]`);

function applyTableFilters(table) {
  const filters = [...table.querySelectorAll("thead .data-table-filter-trigger")]
    .map((trigger) => ({
      col: trigger.closest("th").cellIndex,
      value: document.getElementById(trigger.getAttribute("popovertarget"))?.dataset.value || "",
    }))
    .filter((f) => f.value);
  const panelFilters = [...document.querySelectorAll(`.data-table-filter-panel[data-filter-table="${table.id}"] select[data-filter-col]`)]
    .map((select) => ({
      col: Number(select.dataset.filterCol),
      value: select.dataset.applied || "",
      prefix: select.dataset.filterMatch === "prefix",
    }))
    .filter((f) => f.value);
  const query = document.querySelector(`[data-table-search="${table.id}"]`)?.dataset.applied || "";
  const rows = [...table.tBodies[0].rows].filter((row) => !row.hasAttribute("data-filter-empty"));
  let shown = 0;
  for (const row of rows) {
    const cellText = (col) => row.cells[col]?.textContent.trim() || "";
    const match =
      filters.every((f) => cellText(f.col) === f.value) &&
      panelFilters.every((f) => (f.prefix ? cellText(f.col).startsWith(f.value) : cellText(f.col) === f.value)) &&
      (!query || row.textContent.includes(query));
    row.hidden = !match;
    if (match) shown++;
  }
  // 0 件でも表は消さず、「条件に合うデータがありません」の行を出す
  table.querySelector("[data-filter-empty]")?.toggleAttribute("hidden", shown > 0);
  const status = document.querySelector(`[data-filter-status="${table.id}"]`);
  if (status) {
    const active = filters.length || panelFilters.length || query;
    status.textContent = active ? `全 ${rows.length} 件中 ${shown} 件を表示` : `全 ${rows.length} 件`;
  }
}

// 名前は aria-label、または aria-labelledby が指す要素（見出し行ではツールチップの吹き出し）の文字
function syncFilterTrigger(trigger, value) {
  const labelEl = document.getElementById(trigger.getAttribute("aria-labelledby") || "");
  trigger.dataset.label ||= labelEl ? labelEl.textContent : trigger.getAttribute("aria-label");
  trigger.toggleAttribute("data-filtered", Boolean(value));
  const label = value ? `${trigger.dataset.label}（適用中: ${value}）` : trigger.dataset.label;
  if (labelEl) labelEl.textContent = label;
  else trigger.setAttribute("aria-label", label);
}

document.addEventListener("beforetoggle", (e) => {
  const panel = e.target;
  if (!(panel instanceof HTMLElement) || !panel.classList.contains("data-table-filter-panel")) return;
  if (e.newState !== "open") return;
  panel.style.visibility = "hidden"; // 位置を計算するまで隠す
  if (panel.dataset.filterTable) {
    panel.querySelectorAll("select[data-filter-col]").forEach((s) => { s.value = s.dataset.applied || ""; });
    return;
  }
  const select = panel.querySelector("select");
  if (select) select.value = panel.dataset.value || "";
}, true);

document.addEventListener("toggle", (e) => {
  const panel = e.target;
  if (!(panel instanceof HTMLElement) || !panel.classList.contains("data-table-filter-panel")) return;
  const trigger = filterTrigger(panel);
  const open = e.newState === "open";
  trigger?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    positionActionMenu(panel);
    panel.style.visibility = "";
    panel.querySelector("select")?.focus();
  } else if (trigger && (document.activeElement === document.body || panel.contains(document.activeElement))) {
    trigger.focus(); // フォーカス復帰の保険 (通常は Popover API が戻す)
  }
}, true);

// 適用 = 選んだ値で確定して閉じる。リセット = 「すべて」を適用したのと同じ（その列の絞り込みを解除して閉じる）
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".data-table-filter-panel[popover] :is([data-filter-apply], [data-filter-reset])");
  if (!btn) return;
  const panel = btn.closest(".data-table-filter-panel");
  if (panel.dataset.filterTable) {
    // 見出し行のパネル: 条件ごとに確定し、適用中の条件の数をトリガーの名前に出す
    const selects = [...panel.querySelectorAll("select[data-filter-col]")];
    for (const s of selects) {
      if (btn.hasAttribute("data-filter-reset")) s.value = "";
      s.dataset.applied = s.value;
    }
    const count = selects.filter((s) => s.dataset.applied).length;
    const trigger = filterTrigger(panel);
    if (trigger) syncFilterTrigger(trigger, count ? `${count} 件` : "");
    const table = document.getElementById(panel.dataset.filterTable);
    if (table) applyTableFilters(table);
    panel.hidePopover();
    trigger?.focus();
    return;
  }
  const select = panel.querySelector("select");
  if (select && btn.hasAttribute("data-filter-reset")) select.value = "";
  panel.dataset.value = select?.value || "";
  const trigger = filterTrigger(panel);
  if (trigger) {
    syncFilterTrigger(trigger, panel.dataset.value);
    const table = trigger.closest("table");
    if (table) applyTableFilters(table);
  }
  panel.hidePopover();
  trigger?.focus();
});

// 見出し行の検索 — 送信（虫眼鏡のボタン / Enter）で確定してから行を絞り込む。入力のたびには絞り込まない
// （1 文字ごとに行と件数の告知が変わると、スクリーンリーダーでは入力中の文字と告知が重なるため）
function applyTableSearch(field) {
  field.dataset.applied = field.value.trim();
  const table = document.getElementById(field.dataset.tableSearch);
  if (table) applyTableFilters(table);
}

document.addEventListener("submit", (e) => {
  const field = e.target.querySelector?.("[data-table-search]");
  if (!field) return;
  e.preventDefault();
  applyTableSearch(field);
});

// カタログの検索欄の見本 — 送信してもページを移動しない（送信先が無いため）
document.addEventListener("submit", (e) => {
  if (e.target.querySelector?.(".search-input") && !e.target.querySelector("[data-table-search]")) e.preventDefault();
});

// クリア（×）は明示的な操作なので、押したら全件に戻す（入力欄を空にするのは先頭の Search Input のハンドラ）
document.addEventListener("click", (e) => {
  const field = e.target.closest(".search-input-clear")?.closest(".search-input")?.querySelector("[data-table-search]");
  if (field) applyTableSearch(field);
});

// Tab でパネルの外へ出たら閉じる（トリガーへ戻るのは除く）。移動先の要素が決まってから判定する
document.addEventListener("focusout", (e) => {
  const panel = e.target.closest?.(".data-table-filter-panel:popover-open");
  if (!panel) return;
  setTimeout(() => {
    const active = document.activeElement;
    if (!panel.matches(":popover-open") || panel.contains(active) || active === filterTrigger(panel)) return;
    if (active === document.body) return; // 外側クリックは Popover API の light dismiss に任せる
    panel.hidePopover();
  });
});

// Table sort — 並べ替え (data-table-sort)。見出しのボタンを押すと昇順、もう一度で降順。別の列に移ったら
// その列の昇順から始め、前の列の aria-sort を外す。td の data-sort-value（無ければ表示文字）で比べ、
// 両方が数値として読めれば数値、それ以外は日本語の文字列として比べる。値が同じ行は元の順を保つ（安定ソート）。
// 列フィルターで隠れている行も並べ替え、「条件に合うデータがありません」の行は常に末尾に置く。
const SORT_ICON = { none: "chevrons-up-down", ascending: "chevron-up", descending: "chevron-down" };
const sortKey = (cell) => (cell?.dataset.sortValue ?? cell?.textContent ?? "").trim();
const sortCollator = new Intl.Collator("ja", { numeric: true });

function setSortIcon(th, state) {
  const use = th.querySelector(".data-table-sort-icon use");
  if (!use) return;
  const href = use.getAttribute("href");
  use.setAttribute("href", href.replace(/#lucide-[\w-]+$/, `#lucide-${SORT_ICON[state]}`));
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".data-table-sort");
  const th = btn?.closest("th");
  const table = th?.closest("table.data-table");
  if (!table) return;
  const next = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
  for (const other of table.querySelectorAll("thead th[aria-sort]")) {
    if (other === th) continue;
    other.removeAttribute("aria-sort");
    setSortIcon(other, "none");
  }
  th.setAttribute("aria-sort", next);
  setSortIcon(th, next);

  const col = th.cellIndex;
  const tbody = table.tBodies[0];
  const empty = tbody.querySelector("[data-filter-empty]");
  const rows = [...tbody.rows].filter((row) => row !== empty);
  const dir = next === "ascending" ? 1 : -1;
  rows
    .map((row, i) => ({ row, i, key: sortKey(row.cells[col]) }))
    .sort((a, b) => {
      const na = Number(a.key.replace(/,/g, ""));
      const nb = Number(b.key.replace(/,/g, ""));
      const byValue = a.key !== "" && b.key !== "" && !Number.isNaN(na) && !Number.isNaN(nb)
        ? na - nb
        : sortCollator.compare(a.key, b.key);
      return byValue * dir || a.i - b.i;
    })
    .forEach(({ row }) => tbody.appendChild(row));
  if (empty) tbody.appendChild(empty);

  const status = document.querySelector(`[data-sort-status="${table.id}"]`);
  if (status) {
    const label = btn.textContent.trim();
    status.textContent = `${label}の${next === "ascending" ? "昇順" : "降順"}で並べ替えました`;
  }
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

// Token Input — [data-token-input] の入力欄の値を Enter か「追加」([data-token-add]) でトークンにする。
// 空・重複・上限 (data-max) は受け付けず、入力欄の真下の field-error-text に理由を出す（input-error ＋ aria-invalid）。
// 追加・削除は aria-live の領域で告知し、削除したらフォーカスを次の削除ボタン（無ければ前・入力欄）へ移す。
function tokenInputParts(root) {
  return {
    input: root.querySelector(".token-input-field > .input"),
    list: root.querySelector(".token-input-list"),
    error: root.querySelector(".field-error-text"),
    live: root.querySelector("[aria-live]"),
  };
}

function setTokenError(root, message) {
  const { input, error } = tokenInputParts(root);
  if (!input || !error) return;
  const ids = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== error.id);
  if (message) ids.unshift(error.id);
  input.setAttribute("aria-describedby", ids.join(" "));
  input.classList.toggle("input-error", Boolean(message));
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  error.textContent = message ? `＊${message}` : "";
  error.hidden = !message;
}

function addToken(root) {
  const { input, list, live } = tokenInputParts(root);
  const value = input.value.trim();
  const values = [...list.querySelectorAll(".token-input-label")].map((el) => el.textContent);
  const max = Number(root.dataset.max) || Infinity;
  if (!value) return setTokenError(root, "値を入力してください");
  if (values.includes(value)) return setTokenError(root, `『${value}』はすでに追加されています`);
  if (values.length >= max) return setTokenError(root, `追加できるのは ${max} 件までです`);
  setTokenError(root, "");
  const li = document.createElement("li");
  li.className = "token-input-item";
  const label = document.createElement("span");
  label.className = "token-input-label";
  label.textContent = value;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "token-input-remove";
  remove.setAttribute("aria-label", `『${value}』を削除`);
  remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="./icons.svg#lucide-x"></use></svg>';
  li.append(label, remove);
  list.append(li);
  input.value = "";
  if (live) live.textContent = `『${value}』を追加しました`;
}

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-token-input] [data-token-add]");
  if (add) {
    const root = add.closest("[data-token-input]");
    addToken(root);
    tokenInputParts(root).input.focus();
    return;
  }
  const remove = e.target.closest("[data-token-input] .token-input-remove");
  if (!remove) return;
  const root = remove.closest("[data-token-input]");
  const { input, live } = tokenInputParts(root);
  const token = remove.closest(".token-input-item");
  const value = token.querySelector(".token-input-label").textContent;
  const next = token.nextElementSibling || token.previousElementSibling;
  token.remove();
  (next?.querySelector(".token-input-remove") || input).focus();
  if (live) live.textContent = `『${value}』を削除しました`;
  // 上限のエラーは 1 つ消せば解消する
  if (root.querySelector(".field-error-text:not([hidden])")?.textContent.includes("件まで")) setTokenError(root, "");
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  const input = e.target.closest?.("[data-token-input] .token-input-field > .input");
  if (!input) return;
  e.preventDefault(); // フォームの送信ではなく、トークンの追加にする
  addToken(input.closest("[data-token-input]"));
});
