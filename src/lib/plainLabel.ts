/**
 * The last word on screen for a key the page has no display name for. Internal ids (a lens `career_start`, a fact
 * `work.status`, a technique `self.activation`) must never reach a person as they are: callers look the id up in their
 * own name map first and fall back to this, which drops any dotted prefix and turns the rest into words.
 *
 *   plainLabel('career_start')     → 'Career start'
 *   plainLabel('self.activation')  → 'Activation'
 *   plainLabel('if-it-drifts')     → 'If it drifts'
 */
export function plainLabel(id: string | null | undefined): string {
  const raw = (id ?? '').trim();
  if (!raw) return '';
  const last = raw.split('.').filter(Boolean).pop() ?? raw;
  const words = last.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

/** `names[id]` when the map has a name for it, else the id in plain words */
export function nameOr(names: Readonly<Record<string, string | undefined>> | null | undefined, id: string | null | undefined): string {
  const named = id ? names?.[id]?.trim() : undefined;
  return named || plainLabel(id);
}
