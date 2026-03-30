function formatAskElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Client-only copy while `ask` / stream is in flight. */
export function askWaitMessage(seconds: number): string {
  const elapsed = formatAskElapsed(seconds);
  if (seconds < 10) return `Preparing your answer… ${elapsed}`;
  if (seconds < 60) return `Still consulting the model… ${elapsed}`;
  if (seconds < 120) return `Detailed replies can take 1–3 minutes… ${elapsed}`;
  return `Still generating… ${elapsed}. You can keep this tab open.`;
}
