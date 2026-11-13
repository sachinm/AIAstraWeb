import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePlan } from '../Auth/ProfileGate';
import { fetchPlanBreakdown } from '../Auth/api';
import type { UsageBreakdown } from '../lib/billing';

const SIZE = 32;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CLOSE_DELAY_MS = 150;

/**
 * This window's questions as a small ring left of the avatar, on any plan with a limit (Sachin, 2026-11-13). Hover,
 * focus or a tap opens the breakdown; Escape, leaving it or a click elsewhere closes it.
 */
const UsageRing: React.FC = () => {
  const { t } = useTranslation();
  const { plan } = usePlan();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<{ used: number; value: UsageBreakdown | null } | null>(null);
  const used = plan?.used ?? 0;

  // read when the panel opens, again only after the count moved
  useEffect(() => {
    if (!open || breakdown?.used === used) return undefined;
    let alive = true;
    void fetchPlanBreakdown().then((value) => alive && setBreakdown({ used, value }));
    return () => {
      alive = false;
    };
  }, [open, used, breakdown?.used]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (!plan || plan.exempt || plan.limit === null) return null;

  const { limit } = plan;
  const shown = Math.min(used, limit);
  const left = Math.max(0, limit - used);
  const tone = left === 0 ? 'red' : left === 1 ? 'amber' : 'purple';
  const stroke = { red: 'stroke-red-500', amber: 'stroke-amber-400', purple: 'stroke-purple-500' }[tone];
  const text = { red: 'text-red-200', amber: 'text-amber-200', purple: 'text-gray-200' }[tone];
  const fraction = limit > 0 ? shown / limit : 1;
  const sentence = t(plan.window === 'day' ? 'usage.usedToday' : 'usage.usedMonth', { used: shown, limit });
  const warning = left === 0 ? t('usage.noneLeft') : left === 1 ? t('usage.lastOne') : null;

  const kinds = plan.breakdown !== undefined ? plan.breakdown : breakdown?.used === used ? breakdown.value : null;
  const parts = kinds
    ? [
        t('usage.chat', { count: kinds.chat }),
        ...(kinds.cardchat > 0 ? [t('usage.cardchat', { count: kinds.cardchat })] : []),
        ...(kinds.board_refresh > 0 ? [t('usage.boardRefresh', { count: kinds.board_refresh })] : []),
        ...(kinds.other > 0 ? [t('usage.other', { count: kinds.other })] : []),
      ]
    : null;
  const renews = plan.resets_at
    ? new Date(plan.resets_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        setOpen(false);
        buttonRef.current?.focus();
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={sentence}
        aria-expanded={open}
        aria-controls={panelId}
        data-test-id="usage-ring"
        data-tone={tone}
        onFocus={show}
        onClick={show}
        className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-white/15" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className={`transition-[stroke-dashoffset] duration-300 ${stroke}`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums ${text}`} aria-hidden="true" data-test-id="usage-ring-left">
          {left}
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={t('usage.label')}
        hidden={!open}
        data-test-id="usage-ring-panel"
        className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/15 bg-slate-900 p-3 text-sm shadow-2xl backdrop-blur-md"
      >
        <p className="font-medium text-white">{sentence}</p>
        {warning && <p className={text}>{warning}</p>}
        {parts && (
          <p className="mt-1 text-gray-400" data-test-id="usage-ring-breakdown">
            {parts.join(' · ')}
          </p>
        )}
        {renews && <p className="mt-1 text-gray-400">{t('usage.renews', { date: renews })}</p>}
        {plan.code === 'free' && (
          <Link
            to="/pricing"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex min-h-11 items-center font-medium text-purple-300 hover:text-purple-200 sm:min-h-0"
          >
            {t('usage.upgrade')}
          </Link>
        )}
      </div>
    </div>
  );
};

export default UsageRing;
