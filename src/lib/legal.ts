/** Names used by the legal pages and footers. Both come from the build env; nothing is invented when they are unset. */
export const PRODUCT_NAME = 'AI Astra';
export const LEGAL_ENTITY = (import.meta.env.VITE_LEGAL_ENTITY as string | undefined)?.trim() || `the operator of ${PRODUCT_NAME}`;
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || '';
export const LEGAL_UPDATED = '1 November 2026';
