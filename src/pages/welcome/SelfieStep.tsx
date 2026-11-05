/**
 * The selfie step (server docs/reading-engine/52 §4): live camera, the face gate, and a Take photo button that is
 * enabled only while one face has been steady in the frame. The capture is a 512 × 512 centre crop at JPEG 0.85.
 */
import { useEffect, useRef, useState } from 'react';
import { HINT_TEXT, judgeFrame, loadDetector, Steadiness, toFractions, type FaceDetectorLike, type GateHint } from '../../lib/faceGate';
import { uploadSelfie, type FaceBox } from '../../lib/profileApi';
import { track } from '../../lib/events';
import { SELFIE_CHANGED } from '../../components/UserAvatar';

export default function SelfieStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState<GateHint>('loading');
  const [box, setBox] = useState<FaceBox | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: FaceDetectorLike | null = null;
    let raf = 0;
    let stopped = false;
    const steady = new Steadiness();
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setHint('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      } catch {
        return setHint('unavailable');
      }
      const v = video.current;
      if (!v || stopped) return;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      detector = await loadDetector();
      if (!detector) return setHint('unavailable');
      const loop = () => {
        if (stopped || !detector || !v.videoWidth) {
          raf = requestAnimationFrame(loop);
          return;
        }
        const verdict = judgeFrame(toFractions(detector.detectForVideo(v, performance.now()), v.videoWidth, v.videoHeight));
        const ready = steady.push(verdict.hint === 'ok');
        setHint(verdict.hint === 'ok' ? (ready ? 'ready' : 'hold_still') : verdict.hint);
        setBox(ready && verdict.box ? verdict.box : null);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      detector?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    const v = video.current;
    if (!v || !box) return;
    setBusy(true);
    setError(null);
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) {
      setBusy(false);
      return setError('That photo could not be taken. Try again.');
    }
    const r = await uploadSelfie(blob, box);
    track('question_answer', 'welcome', 'selfie', { ok: r.ok });
    setBusy(false);
    if (r.ok) {
      window.dispatchEvent(new Event(SELFIE_CHANGED));
      onDone();
    }
    else setError(r.message);
  };

  return (
    <div data-testid="selfie-step">
      <h2 className="mb-1 text-2xl font-semibold">A photo of you</h2>
      <p className="mb-4 text-white/70">It becomes your profile picture.</p>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full border-4 border-white/10 bg-black">
        <video ref={video} playsInline muted className="h-full w-full scale-x-[-1] object-cover" data-testid="selfie-video" />
      </div>
      <p className="mt-3 text-center text-white/80" role="status" aria-live="polite" data-testid="selfie-hint">
        {HINT_TEXT[hint]}
      </p>
      {error && <p className="mt-2 text-center text-amber-200">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={!box || busy}
          onClick={() => void capture()}
          className="min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Take photo'}
        </button>
        <button type="button" onClick={onSkip} className="min-h-[48px] rounded-xl border border-white/15 px-6 text-white/80">
          {hint === 'unavailable' ? 'Continue without a photo' : "I'd rather not"}
        </button>
      </div>
    </div>
  );
}
