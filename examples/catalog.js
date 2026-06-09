/*
 * Catalog interaction scripts — shared across all preview pages.
 * Every handler is delegated / selector-guarded, so loading this on a page
 * that lacks the target elements is a harmless no-op.
 * Edit here — build-pages.mjs links it on every generated page.
 *
 * (The old in-page sidebar scroll-spy was dropped: navigation is now
 *  page-to-page, and the active link is marked at build time via
 *  aria-current="page" / .is-active by build-pages.mjs.)
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
document.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab || tab.disabled) return;
  const group = tab.closest("[data-tabgroup]");
  if (!group) return;
  group.querySelectorAll(".tab").forEach((t) => {
    t.setAttribute("aria-selected", t === tab ? "true" : "false");
  });
});
