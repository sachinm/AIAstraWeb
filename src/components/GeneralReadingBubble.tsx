/**
 * The General Reading chat bubble in the phone header (server docs/dashboards/12 §2). It opens General Reading and
 * carries the questions-left count the usage ring showed on a phone. No count for an exempt account or a plan without a
 * limit; a red 0 when none are left (General Reading still opens and shows the plan line).
 */
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../Auth/ProfileGate';
import { useGeneralReadingIfAvailable } from './GeneralReading';

/** the questions left to show on the bubble, or null for none */
export function questionsLeft(plan: { exempt?: boolean; limit: number | null; used?: number | null } | null | undefined): number | null {
  if (!plan || plan.exempt || plan.limit === null || plan.limit === undefined) return null;
  return Math.max(0, plan.limit - (plan.used ?? 0));
}

export default function GeneralReadingBubble({ className = '' }: { className?: string }) {
  const { plan } = usePlan();
  const navigate = useNavigate();
  const open = useGeneralReadingIfAvailable();
  const left = questionsLeft(plan);
  const label = left === null ? 'General Reading' : `General Reading, ${left} ${left === 1 ? 'question' : 'questions'} left`;
  return (
    <button
      type="button"
      onClick={() => (open ? open() : navigate('/dashboard/chat'))}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-200 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
      data-testid="header-general-reading"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {left !== null && (
        <span
          aria-hidden="true"
          data-testid="header-questions-left"
          data-tone={left === 0 ? 'red' : left === 1 ? 'amber' : 'purple'}
          className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-[#0b0a1f] ${left === 0 ? 'bg-red-500' : left === 1 ? 'bg-amber-500' : 'bg-teal-600'}`}
        >
          {left > 99 ? '99+' : left}
        </span>
      )}
    </button>
  );
}
