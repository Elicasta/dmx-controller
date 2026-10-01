import { isShowSection, type ShowSection } from "./show-design";
const PRESETS = "lumarig-section-presets-v1";
export function loadSectionPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS) ?? "[]");
    return Array.isArray(v) ? v.filter(isShowSection).slice(0, 64) : [];
  } catch {
    return [];
  }
}
