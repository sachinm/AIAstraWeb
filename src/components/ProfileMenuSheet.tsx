/**
 * The avatar's full-screen menu on a phone (server docs/dashboards/12 §2): it replaces the side-menu drawer as the
 * navigation. From the top: who is signed in; the dashboards the person chose (the same entries and names as the side
 * menu, from `usePortalDashboards`); General Reading; Profile; Personalize; Plans and usage (with the questions left);
 * Settings; Log out. Escape or the close button shut it; a move to another page shuts it too.
 *
 * It is portalled to `document.body`: the header is a `backdrop-filter` bar, which would clip a fixed child to its 64 px.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, CreditCard, Globe, LogOut, MessageCircle, Sparkles, User as UserIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlan } from '../Auth/ProfileGate';
import { track } from '../lib/events';
import { usePortalDashboards } from '../lib/portalDashboards';
import { useGeneralReadingIfAvailable } from './GeneralReading';
import { SIDE_TABS, focusedActive, focusedEntries } from './SideNav';
import UserAvatar from './UserAvatar';

interface ProfileMenuSheetProps {
  user?: { name: string; email?: string } | null;
  onLogout: () => void;
  onOpenWizard?: () => void;
}

const rowCls =
  'flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-white/85 hover:bg-white/10 focus:bg-white/10 focus:outline-none';

/** the menu's dashboard entries: the three boards, Happy Hour(s) and the focused dashboards, as the person chose them */
export function menuDashboards(portal: ReturnType<typeof usePortalDashboards>) {
  return [
    ...SIDE_TABS.filter((t) => portal.includes(t.id)),
    ...(portal.includes('lucky') ? [{ id: 'lucky' as const, to: '/dashboard/lucky', label: 'Happy Hour(s)', icon: Clock }] : []),
    ...focusedEntries(portal),
  ];
}

export default function ProfileMenuSheet({ user, onLogout, onOpenWizard }: ProfileMenuSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { plan } = usePlan();
  const portal = usePortalDashboards();
  const openGeneralReading = useGeneralReadingIfAvailable();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector<HTMLElement>('[data-menu-first]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // a move to another page shuts it
  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  const go = (to: string, what: string) => {
    track('tab_select', 'menu_sheet', what);
    close(false);
    navigate(to);
  };

  const entries = menuDashboards(portal);
  const planName = plan ? { free: t('menu.planFree'), plus: t('menu.planPlus'), unlimited: t('menu.planUnlimited') }[plan.code] : null;
  const left = plan && !plan.exempt && plan.remaining !== null && plan.limit !== null ? t('menu.leftMonth', { remaining: plan.remaining, limit: plan.limit }) : null;
  const canUpgrade = Boolean(plan && !plan.exempt && plan.code !== 'unlimited');
  const isActive = (to: string) => (to.includes('?') ? focusedActive(to, pathname, search) : pathname.replace(/\/+$/, '') === to && !new URLSearchParams(search).get('lens'));

  const sheet = open && (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={t('menu.open')}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0d0c24] text-white"
      data-testid="profile-menu-sheet"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <UserAvatar className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          {user && <p className="truncate font-semibold">{user.name}</p>}
          {user?.email && <p className="truncate text-[13px] text-white/55">{user.email}</p>}
        </div>
        <button type="button" onClick={() => close()} aria-label="Close the menu" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10" data-testid="profile-menu-sheet-close">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Menu">
        <p className="px-3 pb-1 text-[12px] font-semibold uppercase tracking-wide text-white/45">Dashboards</p>
        <ul className="grid gap-0.5" data-testid="menu-sheet-dashboards">
          {entries.map(({ id, to, label, icon: Icon }, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => go(to, id)}
                aria-current={isActive(to) ? 'page' : undefined}
                className={`${rowCls} ${isActive(to) ? 'bg-white/15 text-white' : ''}`}
                data-testid={`menu-sheet-dashboard-${id}`}
                {...(i === 0 ? { 'data-menu-first': true } : {})}
              >
                <Icon className="h-5 w-5 shrink-0 text-purple-300" aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
        <div role="separator" className="my-3 border-t border-white/10" />
        <button
          type="button"
          className={rowCls}
          data-testid="menu-sheet-general-reading"
          onClick={() => {
            close(false);
            if (openGeneralReading) openGeneralReading();
            else navigate('/dashboard/chat');
          }}
        >
          <MessageCircle className="h-5 w-5 text-purple-300" aria-hidden="true" />
          General Reading
        </button>
        <button type="button" className={rowCls} onClick={() => go('/profile', 'profile')} data-testid="menu-sheet-profile">
          <UserIcon className="h-5 w-5" aria-hidden="true" />
          {t('menu.profile')}
        </button>
        {onOpenWizard && (
          <button
            type="button"
            className={rowCls}
            data-testid="menu-sheet-personalize"
            onClick={() => {
              close(false);
              onOpenWizard();
            }}
          >
            <Sparkles className="h-5 w-5 text-purple-300" aria-hidden="true" />
            Personalize
          </button>
        )}
        <button type="button" className={`${rowCls} items-start py-2`} onClick={() => go('/profile/plan', 'plan')} data-testid="menu-sheet-plan">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span>{t('menu.plan')}</span>
            {(planName || left) && (
              <span className="text-[13px] text-white/55" data-testid="menu-sheet-plan-line">
                {[plan?.exempt ? null : planName, left].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
        </button>
        {canUpgrade && (
          <button type="button" className={`${rowCls} text-purple-200`} onClick={() => go('/pricing', 'upgrade')} data-testid="menu-sheet-upgrade">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            {t('menu.upgrade')}
          </button>
        )}
        <button type="button" className={rowCls} onClick={() => go('/profile/locale', 'settings')} data-testid="menu-sheet-settings">
          <Globe className="h-5 w-5" aria-hidden="true" />
          Settings
        </button>
        <div role="separator" className="my-3 border-t border-white/10" />
        <button
          type="button"
          className={rowCls}
          data-testid="menu-sheet-logout"
          onClick={() => {
            close(false);
            onLogout();
          }}
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {t('menu.logout')}
        </button>
      </nav>
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('menu.open')}
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
        data-testid="profile-menu-sheet-button"
      >
        <UserAvatar className="h-8 w-8" />
      </button>
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
