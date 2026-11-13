/** The face on screen: one of four, chosen by the card's options. */
import type { FaceProps } from '../cardModel';
import BreakdownFace from './BreakdownFace';
import LightFace from './LightFace';
import ReadFace from './ReadFace';
import ResearchFace from './ResearchFace';

export default function FaceBody(props: FaceProps) {
  switch (props.options.face) {
    case 'light':
      return <LightFace {...props} />;
    case 'breakdown':
      return <BreakdownFace {...props} />;
    case 'research':
      return <ResearchFace {...props} />;
    default:
      return <ReadFace {...props} />;
  }
}
