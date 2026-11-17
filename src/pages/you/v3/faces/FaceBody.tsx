/** The face on screen: Read (default) or Short. Faces stored by older builds (Light, Breakdown, Research) read as Read or Short. */
import type { CardFace } from '../../../../lib/cardOptions';
import type { FaceProps } from '../cardModel';
import ReadFace from './ReadFace';
import ShortFace from './ShortFace';

export type ShownFace = 'read' | 'short';

/** the stored face as one of the two shown; Short only when the server allows it */
export function shownFace(face: CardFace | string | undefined, shortOn = true): ShownFace {
  return shortOn && (face === 'light' || face === 'short') ? 'short' : 'read';
}

export default function FaceBody({ face, ...props }: FaceProps & { face: ShownFace }) {
  return face === 'short' ? <ShortFace {...props} /> : <ReadFace {...props} />;
}
