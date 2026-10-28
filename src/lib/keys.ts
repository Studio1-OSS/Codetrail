// When a page-wide shortcut may act on a key press: never while typing or while a dialog is open, and never for a
// key the focused control uses itself (Space presses a button; arrows move between tabs and radio options).
type Target = { closest(selector: string): unknown } | null;

const TYPING = "input, textarea, select, [contenteditable]";
const USES_SPACE = "button, a, summary, [role=button], [role=tab], [role=radio], [role=checkbox], [tabindex]";
const USES_ARROWS = "[role=tab], [role=radio], [role=slider], [role=listbox]";

export function shortcutAllowed(key: string, target: Target, dialogOpen: boolean): boolean {
  if (dialogOpen || target?.closest(TYPING)) return false;
  if (key === " " && target?.closest(USES_SPACE)) return false;
  if (key.startsWith("Arrow") && target?.closest(USES_ARROWS)) return false;
  return true;
}
