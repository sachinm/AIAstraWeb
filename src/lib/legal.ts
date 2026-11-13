/** Names used by the legal pages and footers. Both come from the build env; nothing is invented when they are unset. */
export const PRODUCT_NAME = 'AdAstra AI';
export const PRODUCT_TAGLINE = 'Your personal Vedic astrologer.';
/** Name and tagline as one label (link titles, aria-labels), so without the tagline's closing period. */
export const PRODUCT_TITLE = `${PRODUCT_NAME} – Your personal Vedic astrologer`;
export const LEGAL_ENTITY = (import.meta.env.VITE_LEGAL_ENTITY as string | undefined)?.trim() || `the operator of ${PRODUCT_NAME}`;
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || '';
export const LEGAL_UPDATED = '2 November 2026';
/** The Terms page has its own date: it changes on its own, and the sign-up and sign-in boxes record which version was agreed. */
export const TERMS_UPDATED = '8 November 2026';
/** Sent as `termsVersion` with every acceptance (sign-up and sign-in). Change it whenever the Terms text changes. */
export const TERMS_VERSION = '2026-11-08';
