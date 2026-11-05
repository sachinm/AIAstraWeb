/**
 * The sign-up birth-details draft, held in memory for this tab's life only (server docs/privacy/02 §4.3, B0.3). It
 * survives moving between the two sign-up pages; a page refresh loses it, which is accepted. Never written to storage.
 */
let draft: unknown = null;
/** Which birth-details step the person was on, kept with the draft and cleared with it. */
let step: string | null = null;

export function readSignupDraft<T>(): Partial<T> | null {
  return draft && typeof draft === 'object' ? (draft as Partial<T>) : null;
}

export function saveSignupDraft<T>(value: T): void {
  draft = value;
}

export function readSignupStep(): string | null {
  return step;
}

export function saveSignupStep(value: string): void {
  step = value;
}

export function clearSignupDraft(): void {
  draft = null;
  step = null;
}
