import type { Components } from 'react-markdown';

/** Shared ReactMarkdown overrides for chat AI bubbles (GFM tables, images). */
export const chatMarkdownComponents: Components = {
  table: ({ children }) => (
    <div className="not-prose my-4 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/20">
      <table className="w-max min-w-full text-left text-sm border-collapse text-white">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/25 px-2 py-1.5 sm:px-3 sm:py-2 font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-white/15 px-2 py-1.5 sm:px-3 sm:py-2">{children}</td>
  ),
  img: ({ src, alt }) =>
    typeof src === 'string' && src.startsWith('https://') ? (
      <img
        src={src}
        alt={alt ?? ''}
        className="max-h-64 max-w-full rounded-lg object-contain my-4 border border-white/20"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    ) : null,
};
