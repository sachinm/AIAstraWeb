import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gaEvent, gaPageView, gaSetUser } from './ga';
import { track, _reset } from './events';

describe('google analytics', () => {
  const gtag = vi.fn();
  beforeEach(() => {
    gtag.mockClear();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
    _reset();
  });

  it('sends a choice as select_content with the surface and what was picked', () => {
    gaEvent('scenario_add', 'lucky', 'work.sign_contract', { week: 2 });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'select_content',
      expect.objectContaining({ content_type: 'lucky:scenario_add', item_id: 'work.sign_contract', event_surface: 'lucky', event_target: 'work.sign_contract', event_detail: 'week=2' })
    );
  });

  it('keeps its own name for events that are not choices', () => {
    gaEvent('why_open', 'work', 'promotion');
    expect(gtag).toHaveBeenCalledWith('event', 'why_open', { event_surface: 'work', event_target: 'promotion' });
  });

  it('track() reaches Google Analytics too, and page_view is left to route changes', () => {
    track('tab_select', 'sidenav', 'love');
    track('page_view', 'lucky');
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('sends a page view with the path, and sets the person by id and plan, never an email', () => {
    gaPageView('/dashboard/work', 'Work');
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ page_path: '/dashboard/work' }));
    gaSetUser('abc-123', 'free');
    expect(gtag).toHaveBeenCalledWith('set', { user_id: 'abc-123' });
    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { plan: 'free' });
  });

  it('does nothing without the tag', () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    expect(() => gaEvent('why_open', 'work')).not.toThrow();
  });
});
