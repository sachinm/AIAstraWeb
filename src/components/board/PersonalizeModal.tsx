/** The Personalize wizard in a modal, opened from the Self board's title. Moved here unchanged from the v2 Self board. */
import WelcomeWizard from '../../pages/welcome/WelcomeWizard';

export default function PersonalizeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Personalize your readings" onClick={onClose} data-testid="self-personalize-modal">
      <div className="relative flex h-[min(640px,88vh)] w-[min(880px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0c24] p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-semibold text-white">Personalize Your Readings</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <WelcomeWizard onFinish={onClose} inModal />
      </div>
    </div>
  );
}
