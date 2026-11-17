/**
 * The one writer of the Self board's layout (doc 75). Every change (a card's options, the board's gear, the deck from
 * Edit, the picker or the template) lands in `pending` and shows at once; saves go out one batch at a time, never two
 * in flight, each built from the last layout the server confirmed plus what is pending, so an older copy can never be
 * written over a newer one.
 *
 * A batch is one small PATCH per change carrying the layout version. On 409 the layout is read again and the change
 * reapplied once; on 401 the session is refreshed quietly and the change retried once, else the change stays pending
 * and the person is told the session ended. A server without the PATCH routes (404/405) gets one PUT of the latest
 * layout instead. A refusal (400, a failure) drops that change and the card goes back to what is saved.
 */
import { optionsFor, type BoardOptions, type CardOptions } from '../../../lib/cardOptions';
import type {
  LayoutPatch,
  LayoutPatchError,
  LayoutPatchResult,
  SelfBoardLayout,
  SelfBoardLayoutView,
  SelfCardId,
  SelfTemplateId,
  SelfV3LayoutBody,
} from '../../../lib/selfV3Api';

export const LAYOUT_SAVE_DELAY_MS = 400;

export interface Deck {
  template: SelfTemplateId;
  cards: SelfCardId[];
  sections: SelfBoardLayout['sections'];
}

export interface Pending {
  /** per card, its whole own map ({} clears it) */
  cards: Map<string, Partial<CardOptions>>;
  board: Partial<BoardOptions> | null;
  deck: Deck | null;
}

export type SaveProblem = 'session' | Exclude<LayoutPatchError, 'conflict' | 'unauthorized' | 'unsupported'>;

export interface SaverDeps {
  patch: (p: LayoutPatch, version: number | undefined) => Promise<LayoutPatchResult>;
  put: (body: SelfV3LayoutBody & { version?: number }) => Promise<LayoutPatchResult>;
  refetch: () => Promise<SelfBoardLayoutView | null>;
  refresh: () => Promise<boolean>;
  /** the layout to draw: the saved one with everything pending applied */
  onLayout: (l: SelfBoardLayoutView) => void;
  /** a deck save queued cards for reading */
  onQueued?: (ids: SelfCardId[]) => void;
  /** a change was refused or the session ended */
  onProblem: (p: SaveProblem) => void;
  /** a save went through after a problem */
  onSaved?: () => void;
  delay?: number;
}

const empty = (): Pending => ({ cards: new Map(), board: null, deck: null });
const isEmpty = (p: Pending) => !p.cards.size && !p.board && !p.deck;

/** `later` over `earlier`: the newer choice wins key by key */
function merge(earlier: Pending, later: Pending): Pending {
  const cards = new Map(earlier.cards);
  for (const [id, o] of later.cards) cards.set(id, o);
  return { cards, board: later.board ?? earlier.board, deck: later.deck ?? earlier.deck };
}

/** the layout with the pending changes applied */
export function applyPending(l: SelfBoardLayoutView, p: Pending): SelfBoardLayoutView {
  const out: SelfBoardLayoutView = { ...l };
  if (p.deck) {
    out.template = p.deck.template;
    out.cards = p.deck.cards;
    out.sections = p.deck.sections;
  }
  if (p.board) out.boardOptions = p.board;
  if (p.cards.size || p.deck) {
    const options = { ...(l.options ?? {}) };
    for (const [id, o] of p.cards) {
      if (Object.keys(o).length) options[id] = o;
      else delete options[id];
    }
    out.options = optionsFor(options, out.cards);
  }
  return out;
}

/** the batch as PATCHes: the deck first (it decides which cards stay), then the board, then each card still on it */
export function toPatches(p: Pending, cardsAfter: readonly string[]): LayoutPatch[] {
  const out: LayoutPatch[] = [];
  if (p.deck) out.push({ kind: 'deck', ...p.deck });
  if (p.board) out.push({ kind: 'board', boardOptions: p.board });
  for (const [id, options] of p.cards) if (cardsAfter.includes(id)) out.push({ kind: 'card', id: id as SelfCardId, options });
  return out;
}

export class LayoutSaver {
  private saved: SelfBoardLayoutView;
  private pending: Pending = empty();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private running = 0;
  /** null until the first PATCH answers; false once the server says the routes are not there */
  private patchLive: boolean | null = null;
  private deckOk = true;
  private problem = false;

  constructor(
    initial: SelfBoardLayoutView,
    private readonly deps: SaverDeps,
  ) {
    this.saved = initial;
  }

  /** what to draw now */
  view(): SelfBoardLayoutView {
    return applyPending(this.saved, this.pending);
  }

  /** true while a change is waiting or on its way: a board read again must not overwrite the layout */
  busy(): boolean {
    return this.running > 0 || this.timer !== null || !isEmpty(this.pending);
  }

  /** a board read again carries the stored layout: taken only when nothing of ours is outstanding */
  serverLayout(l: SelfBoardLayoutView): void {
    if (this.busy()) return;
    this.saved = l;
  }

  changeCard(id: string, own: Partial<CardOptions>): void {
    this.pending.cards.set(id, own);
    this.changed();
  }

  changeBoard(board: Partial<BoardOptions>): void {
    this.pending.board = board;
    this.changed();
  }

  /** the deck goes out at once; resolves true when it was stored */
  saveDeck(deck: Deck): Promise<boolean> {
    this.pending.deck = deck;
    this.deps.onLayout(this.view());
    this.deckOk = true;
    return this.flush().then(() => this.deckOk);
  }

  /** send what is waiting now (on Retry, on close) */
  flush(): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.running += 1;
    const run = this.chain.then(() => this.runBatch()).finally(() => (this.running -= 1));
    this.chain = run.catch(() => false);
    return run;
  }

  private changed(): void {
    this.deps.onLayout(this.view());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.deps.delay ?? LAYOUT_SAVE_DELAY_MS);
  }

  private async runBatch(): Promise<boolean> {
    if (isEmpty(this.pending)) return true;
    const batch = this.pending;
    this.pending = empty();
    const cardsAfter = batch.deck?.cards ?? this.saved.cards;
    let ok = true;
    let session = false;
    const left: Pending = empty();

    const sendPut = async (): Promise<LayoutPatchResult> => {
      const l = applyPending(this.saved, batch);
      return this.deps.put({
        template: l.template,
        cards: l.cards,
        sections: l.sections,
        options: l.options ?? {},
        boardOptions: l.boardOptions ?? {},
        ...(this.saved.version !== undefined ? { version: this.saved.version } : {}),
      });
    };

    /** one request with the 409 and 401 rules; 'unsupported' falls through to the caller */
    const attempt = async (send: () => Promise<LayoutPatchResult>): Promise<LayoutPatchResult> => {
      let r = await send();
      if (!r.ok && r.error === 'conflict') {
        const fresh = await this.deps.refetch();
        if (fresh) this.saved = fresh;
        r = await send();
      }
      if (!r.ok && r.error === 'unauthorized') {
        if (await this.deps.refresh()) r = await send();
      }
      return r;
    };

    const patches = toPatches(batch, cardsAfter);
    let usePut = this.patchLive === false;
    for (const p of usePut ? [] : patches) {
      const r = await attempt(() => this.deps.patch(p, this.saved.version));
      if (!r.ok && r.error === 'unsupported') {
        this.patchLive = false;
        usePut = true;
        break;
      }
      this.patchLive = true;
      if (r.ok) {
        this.saved = r.layout;
        if (r.queued.length) this.deps.onQueued?.(r.queued);
        continue;
      }
      if (r.error === 'unauthorized') {
        session = true;
        if (p.kind === 'card') left.cards.set(p.id, p.options);
        else if (p.kind === 'board') left.board = p.boardOptions;
        else left.deck = { template: p.template, cards: p.cards, sections: p.sections };
        continue;
      }
      ok = false;
      if (p.kind === 'deck') this.deckOk = false;
      this.deps.onProblem(r.error === 'conflict' || r.error === 'unsupported' ? 'failed' : r.error);
    }
    if (usePut) {
      const r = await attempt(sendPut);
      if (r.ok) {
        this.saved = r.layout;
        if (r.queued.length) this.deps.onQueued?.(r.queued);
      } else if (r.error === 'unauthorized') {
        session = true;
        Object.assign(left, merge(left, batch));
      } else {
        ok = false;
        if (batch.deck) this.deckOk = false;
        this.deps.onProblem(r.error === 'conflict' || r.error === 'unsupported' ? 'failed' : r.error);
      }
    }

    // a change the session cut off stays on screen and waits, under anything chosen since
    if (session) {
      this.pending = merge(left, this.pending);
      if (left.deck) this.deckOk = false;
      this.problem = true;
      this.deps.onProblem('session');
    } else if (ok && this.problem) {
      this.problem = false;
      this.deps.onSaved?.();
    }
    this.deps.onLayout(this.view());
    return ok && !session;
  }
}
