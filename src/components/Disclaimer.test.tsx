import { vi } from 'vitest';
vi.mock('../pages/TopNavigation', () => ({ default: () => null }));
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Disclaimer, { DISCLAIMER_TEXT } from './Disclaimer';
import Dashboard from '../pages/Dashboard';

const user = { name: 'A', email: 'a@b.c', age: 30, dateOfBirth: '', placeOfBirth: '', timeOfBirth: '' };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} onLogout={() => undefined} />}>
          <Route path="charts" element={<div>charts page</div>} />
          <Route path="chat" element={<div>chat page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Disclaimer', () => {
  it('says education and entertainment only, not financial advice, lifestyle choices are your own', () => {
    render(<Disclaimer />);
    expect(screen.getByRole('note')).toHaveTextContent(DISCLAIMER_TEXT);
    expect(DISCLAIMER_TEXT).toMatch(/education and entertainment purposes only/i);
    expect(DISCLAIMER_TEXT).toMatch(/not financial advice/i);
    expect(DISCLAIMER_TEXT).toMatch(/lifestyle choices are your own/i);
  });
  it('appears in the dashboard footer on dashboard pages', () => {
    renderAt('/dashboard/charts');
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
  it('is left to the chat page itself on the chat route (shown under the input there)', () => {
    renderAt('/dashboard/chat');
    expect(screen.queryByText(DISCLAIMER_TEXT)).not.toBeInTheDocument();
  });
});
