/**
 * The signed-in background (Sachin, 2026-11-05): a plain royal dark-blue sky with a few faint stars and the front page's
 * shooting stars. The photo scenes made the words hard to read, so they stay on the public pages only.
 */
export default function NightSky({ className = '' }: { className?: string }) {
  return (
    <div className={`royal-sky pointer-events-none fixed inset-0 overflow-hidden ${className}`} aria-hidden="true" data-test-id="night-sky">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="shooting-star absolute h-1 w-1 rounded-full bg-white opacity-0"
          style={{ top: `${12 + i * 26}%`, left: '-5%', animationDuration: `${16 + i * 5}s`, animationDelay: `${i * 9}s` }}
        />
      ))}
    </div>
  );
}
