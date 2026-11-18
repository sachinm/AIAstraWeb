/**
 * Which board a card is drawn on (server docs/dashboards/10 W4). The parts deep inside a card ("Is this right?", the
 * period memory) save through their board's routes; outside a board (component tests) they are Self's.
 */
import { createContext, useContext } from 'react';
import type { BoardId } from '../../../lib/selfV3Api';

export const BoardIdContext = createContext<BoardId>('self');

export const useBoardId = (): BoardId => useContext(BoardIdContext);
