import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpen, ChevronDown, CreditCard, Heart, History, LogOut, MessageCircle, Settings, Sparkles, User as UserIcon, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../Auth/ProfileGate';
import { ShriGaneshAvatar } from './ShriGaneshAvatar';

interface ProfileMenuProps {
  user?: { name: string; email?: string } | null;
  onLogout: () => void;
}

const itemCls =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left sm:min-h-0 text-sm text-gray-200 hover:bg-white/10 focus:bg-white/10 focus:outline-none';

/** The avatar's dropdown: who is signed in, their plan, and where to go. */
const ProfileMenu: React.FC<ProfileMenuProps> = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plan } = usePlan();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    list[(at + step + list.length) % list.length]?.focus();
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const canUpgrade = Boolean(plan && !plan.exempt && plan.code !== 'unlimited');
  const planName = plan
    ? { free: t('menu.planFree'), plus: t('menu.planPlus'), unlimited: t('menu.planUnlimited') }[plan.code]
    : null;
  const left =
    plan && !plan.exempt && plan.remaining !== null && plan.limit !== null
      ? t('menu.leftMonth', { remaining: plan.remaining, limit: plan.limit })
      : null;

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu.open')}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full p-1 text-gray-300 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <ShriGaneshAvatar />
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="menu"
          aria-label={t('menu.open')}
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/15 bg-slate-900 p-2 shadow-2xl backdrop-blur-md"
        >
          {user && (
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate font-medium text-white">{user.name}</p>
              {user.email && <p className="truncate text-sm text-gray-400">{user.email}</p>}
            </div>
          )}
          {planName && !plan?.exempt && (
            <div className="border-b border-white/10 px-3 py-2 text-sm" data-test-id="profile-menu-plan">
              <p className="font-medium text-purple-300">{planName}</p>
              {left && <p className="text-gray-400">{left}</p>}
            </div>
          )}
          <div className="pt-1">
            {canUpgrade && (
              <button type="button" role="menuitem" className={`${itemCls} text-purple-200`} onClick={() => go('/pricing')}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t('menu.upgrade')}
              </button>
            )}
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/dashboard/chat')}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t('menu.chat')}
            </button>
            {import.meta.env.VITE_LUCKY_ENABLED === '1' && (
              <button type="button" role="menuitem" className={itemCls} onClick={() => go('/dashboard/lucky')}>
                <Clock className="h-4 w-4" aria-hidden="true" />
                {t('menu.lucky')}
              </button>
            )}
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/dashboard/charts')}>
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              {t('menu.charts')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/dashboard/remedies')}>
              <Heart className="h-4 w-4" aria-hidden="true" />
              {t('menu.remedies')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/dashboard/mantras')}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t('menu.mantras')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/profile')}>
              <UserIcon className="h-4 w-4" aria-hidden="true" />
              {t('menu.profile')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/profile/plan')}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {t('menu.plan')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/profile/timeline')}>
              <History className="h-4 w-4" aria-hidden="true" />
              {t('menu.timeline')}
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => go('/profile/settings')}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t('menu.settings')}
            </button>
            <button
              type="button"
              role="menuitem"
              className={itemCls}
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t('menu.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
