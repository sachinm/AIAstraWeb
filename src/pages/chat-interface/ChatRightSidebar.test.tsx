import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatRightSidebar from './ChatRightSidebar';
import * as UserData from '../UserData';

vi.mock('../UserData', () => ({ fetchKundliDisplayData: vi.fn() }));

const base = {
  success: true,
  biodata: { date: '1990-04-27', time: '10:30:00', place_name: 'Pune, IN', nakshatra: 'Kaettai  (Me☿) Quarter-3 21:29:55 (-1) from 23:40:41 ends' },
  d1: [{ body: 'Lagna', longitude: '20 Vi 12', nakshatra: 'Hast', pada: '4', rasi: 'Vi' }],
  d7: null,
  d9: null,
  d10: null,
  vimsottari_dasa: null,
  narayana_dasa: null,
  research: false,
};

describe('ChatRightSidebar', () => {
  beforeEach(() => vi.mocked(UserData.fetchKundliDisplayData).mockReset());

  it('shows only the birth details, Lagna and Nakshatra by default', async () => {
    vi.mocked(UserData.fetchKundliDisplayData).mockResolvedValue(base);
    render(<ChatRightSidebar isOpen onOpenChange={() => undefined} />);
    expect(await screen.findByText('Vi')).toBeInTheDocument();
    expect(screen.getByText('Hast, pada 4')).toBeInTheDocument();
    expect(screen.getByText('Kaettai, Quarter 3')).toBeInTheDocument();
    expect(screen.getByText('Pune, IN')).toBeInTheDocument();
    for (const title of ['D7', 'D9', 'D10', 'Vimsottari Dasa', 'Narayana Dasa']) expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it('shows the charts and dashas when the account has the research flag', async () => {
    vi.mocked(UserData.fetchKundliDisplayData).mockResolvedValue({ ...base, research: true });
    render(<ChatRightSidebar isOpen onOpenChange={() => undefined} />);
    for (const title of ['D7', 'D9', 'D10', 'Vimsottari Dasa', 'Narayana Dasa']) expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('never shows the browser error, and Retry loads again', async () => {
    vi.mocked(UserData.fetchKundliDisplayData).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(base);
    const user = userEvent.setup();
    render(<ChatRightSidebar isOpen onOpenChange={() => undefined} />);
    expect(await screen.findByText(/could not load your Kundli/i)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Vi')).toBeInTheDocument());
    expect(UserData.fetchKundliDisplayData).toHaveBeenCalledTimes(2);
  });

  it('says so when the chart has no data yet', async () => {
    vi.mocked(UserData.fetchKundliDisplayData).mockResolvedValue({ ...base, biodata: null, d1: null });
    render(<ChatRightSidebar isOpen onOpenChange={() => undefined} />);
    expect((await screen.findAllByText('Not available yet')).length).toBeGreaterThan(0);
  });
});
