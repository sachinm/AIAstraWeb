import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardToolbar, { FACES } from './CardToolbar';

describe('the face switch', () => {
  it('has exactly Read and Short', () => {
    render(<CardToolbar cardId="body" face="read" onFace={() => {}} />);
    expect(FACES).toEqual(['read', 'short']);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Read', 'Short']);
    expect(screen.getByTestId('face-read')).toHaveAttribute('aria-checked', 'true');
  });

  it('arrow keys move between the two faces and wrap', () => {
    const onFace = vi.fn();
    render(<CardToolbar cardId="body" face="short" onFace={onFace} />);
    fireEvent.keyDown(screen.getByTestId('face-switch'), { key: 'ArrowRight' });
    expect(onFace).toHaveBeenCalledWith('read');
  });

  it('marks a card that keeps its own choice', () => {
    render(<CardToolbar cardId="body" face="read" onFace={() => {}} hasOwn />);
    expect(screen.getByTestId('toolbar-own-dot')).toBeInTheDocument();
  });

  it('shows only vetted availableTools and hides tool-switch completely when availableTools is empty, while keeping Chart details', () => {
    const { unmount } = render(
      <CardToolbar cardId="stuck" face="read" tools={['plan']} availableTools={['plan']} onFace={() => {}} onTool={() => {}} onDetails={() => {}} />,
    );
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-vetted-tools', '1');
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByTestId('tool-plan')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('tool-table')).toBeNull();
    expect(screen.getByTestId('toolbar-details')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-details')).not.toHaveAttribute('aria-pressed');
    unmount();

    const onDetails = vi.fn();
    render(<CardToolbar cardId="lagna" face="read" tools={['table']} availableTools={[]} onFace={() => {}} onTool={() => {}} onDetails={onDetails} />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-vetted-tools', '0');
    expect(screen.queryByTestId('tool-switch')).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByTestId('toolbar-details'));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('exposes a single tabIndex=0 stop and navigates across faces, vetted tools, and Chart details via Arrow/Home/End keys; separator uses a border', () => {
    const onFace = vi.fn();
    render(
      <CardToolbar
        cardId="body"
        face="read"
        tools={[]}
        availableTools={['table', 'plan']}
        onFace={onFace}
        onTool={() => {}}
        onDetails={() => {}}
      />,
    );
    const toolbar = screen.getByRole('toolbar');
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByTestId('face-read')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('tool-table')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('toolbar-details')).toHaveAttribute('tabindex', '-1');

    // Separator uses a real CSS border rather than background-only so forced-colors preserves it
    expect(screen.getByRole('separator').className).toContain('border-l');

    // End jumps straight to Chart details and makes it the single tab stop
    fireEvent.keyDown(screen.getByTestId('face-read'), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByTestId('toolbar-details'));
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByTestId('toolbar-details')).toHaveAttribute('tabindex', '0');

    // ArrowLeft moves from Chart details onto tool-plan without altering the face
    fireEvent.keyDown(screen.getByTestId('toolbar-details'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByTestId('tool-plan'));
    expect(onFace).not.toHaveBeenCalled();

    // Home wraps back to face-read
    fireEvent.keyDown(screen.getByTestId('tool-plan'), { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByTestId('face-read'));
  });
});
