/**
 * The Love board placeholder (server docs/reading-engine/45 §8.2). The Love engine is the next build after Work; until
 * then the tab says so plainly instead of showing a general prediction (AGENTS.md: specific to the person or not shown).
 */
export default function LovePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white sm:px-6" data-testid="love-page">
      <h1 className="mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">Love</h1>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80">
        Meeting someone, keeping it good, and mending what is strained. This board is being built next.
      </div>
    </div>
  );
}
