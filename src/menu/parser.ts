/**
 * Menu / service parser layer: menu_items[] and synonyms[] for better recognition.
 * Example: shawarma → شاورما → sandwich → wrap
 */

export interface MenuItem {
  /** Canonical name (e.g. "Shawarma") */
  id: string;
  /** Display name in primary language */
  name: string;
  /** Synonyms and alternate names (Arabic, English, slang) */
  synonyms: string[];
}

export interface MenuConfig {
  menu_items: MenuItem[];
}

/**
 * Build a single flat list of canonical → all terms for quick lookup.
 */
function buildLookup(config: MenuConfig): Map<string, string> {
  const m = new Map<string, string>();
  for (const item of config.menu_items) {
    const canonical = item.name.trim().toLowerCase();
    m.set(canonical, item.id);
    for (const s of item.synonyms) {
      const t = s.trim().toLowerCase();
      if (t) m.set(t, item.id);
    }
  }
  return m;
}

/**
 * Parse config from static SERVICES_OR_MENU text (legacy) or from structured menu_items.
 * If you have menu_items, use parseMenuConfig; otherwise use fallback from text.
 */
export function parseMenuConfig(config: MenuConfig): { lookup: Map<string, string>; canonicalIds: string[] } {
  const lookup = buildLookup(config);
  const canonicalIds = [...new Set(config.menu_items.map((i) => i.id))];
  return { lookup, canonicalIds };
}

/**
 * Normalize user input to canonical menu item IDs. Returns matched IDs and unrecognized tokens.
 */
export function normalizeToMenuItems(
  input: string,
  config: MenuConfig
): { matched: string[]; unrecognized: string[] } {
  const { lookup } = parseMenuConfig(config);
  const tokens = input
    .split(/[\s,،]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const matched = new Set<string>();
  const unrecognized: string[] = [];
  for (const t of tokens) {
    const id = lookup.get(t);
    if (id) matched.add(id);
    else if (t.length > 1) unrecognized.push(t);
  }
  return { matched: [...matched], unrecognized };
}

/**
 * Build prompt snippet: "Recognize these services/items and their synonyms: ..."
 * Improves LLM recognition when injected into system prompt.
 */
export function buildMenuPromptSnippet(config: MenuConfig): string {
  const lines: string[] = ['Recognize these services/items and synonyms:'];
  for (const item of config.menu_items) {
    const all = [item.name, ...item.synonyms].filter(Boolean);
    lines.push(`- ${item.id}: ${all.join(' | ')}`);
  }
  return lines.join('\n');
}

/**
 * Convert legacy SERVICES_OR_MENU string into a minimal MenuConfig (one item per line or comma).
 * For full synonyms use proper menu_items in business config.
 */
export function legacyMenuFromText(servicesOrMenuText: string): MenuConfig {
  const items = servicesOrMenuText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const menu_items: MenuItem[] = items.map((name, i) => ({
    id: `item-${i + 1}`,
    name,
    synonyms: [],
  }));
  return { menu_items };
}
