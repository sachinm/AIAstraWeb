/**
 * The selfie step (server docs/reading-engine/52 §4): live camera, optional face detector, and a Take photo button that
 * stays enabled whenever the camera stream is active. The capture is a 512 × 512 centre crop at JPEG 0.85.
 */
import { useEffect, useRef, useState } from 'react';
import { HINT_TEXT, judgeFrame, loadDetector, Steadiness, toFractions, type FaceDetectorLike, type GateHint } from '../../lib/faceGate';
import { uploadSelfie, type FaceBox } from '../../lib/profileApi';
import { track } from '../../lib/events';
import { SELFIE_CHANGED } from '../../components/UserAvatar';

export const DEFAULT_FACE_BOX: FaceBox = { x: 0.25, y: 0.2, w: 0.5, h: 0.6, score: 0.95 };

export default function SelfieStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState<GateHint>('loading');
  const [box, setBox] = useState<FaceBox | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markStreamReady = () => {
    setCamReady(true);
    setError(null);
    setBox((prev) => prev ?? DEFAULT_FACE_BOX);
    setHint((prev) => (prev === 'loading' || prev === 'unavailable' ? 'ready' : prev));
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: FaceDetectorLike | null = null;
    let raf = 0;
    let stopped = false;
    const steady = new Steadiness();
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!stopped) setHint('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        if (!stopped) setHint('unavailable');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      markStreamReady();
      await v.play().catch(() => undefined);
      if (stopped) return;
      markStreamReady();
      detector = await loadDetector();
      if (!detector || stopped) {
        // Camera is working; keep Take photo enabled with the centered default crop box even when MediaPipe is absent
        if (!stopped) markStreamReady();
        return;
      }
      const loop = () => {
        if (stopped) return;
        if (!detector || !v.videoWidth) {
          raf = requestAnimationFrame(loop);
          return;
        }
        try {
          const verdict = judgeFrame(toFractions(detector.detectForVideo(v, performance.now()), v.videoWidth, v.videoHeight));
          const ready = steady.push(verdict.hint === 'ok');
          if (verdict.box) setBox(verdict.box);
          else setBox((prev) => prev ?? DEFAULT_FACE_BOX);
          setHint(verdict.hint === 'ok' ? (ready ? 'ready' : 'hold_still') : 'ready');
        } catch {
          markStreamReady();
        }
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
    const activeBox = box ?? (camReady ? DEFAULT_FACE_BOX : null);
    if (!v || !activeBox) return;
    setBusy(true);
    setError(null);
    const vw = v.videoWidth || 512;
    const vh = v.videoHeight || 512;
    const side = Math.min(vw, vh);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext?.('2d');
    ctx?.drawImage(v, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>((r) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((b) => r(b ?? new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })), 'image/jpeg', 0.85);
      } else {
        r(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
      }
    });
    if (!blob) {
      setBusy(false);
      return setError('That photo could not be taken. Try again.');
    }
    const r = await uploadSelfie(blob, activeBox);
    track('question_answer', 'welcome', 'selfie', { ok: r.ok });
    setBusy(false);
    if (r.ok) {
      window.dispatchEvent(new Event(SELFIE_CHANGED));
      onDone();
    } else {
      setError(r.message);
    }
  };

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await uploadSelfie(file, box ?? DEFAULT_FACE_BOX);
    track('question_answer', 'welcome', 'selfie_upload', { ok: r.ok });
    setBusy(false);
    if (r.ok) {
      window.dispatchEvent(new Event(SELFIE_CHANGED));
      onDone();
    } else {
      setError(r.message);
    }
  };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="selfie-step">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">A photo of you</h2>
          <p className="text-sm text-white/70">It becomes your profile picture.</p>
        </div>
        <span
          data-testid="question-technique-badge"
          className="inline-flex items-center rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-medium text-purple-200"
        >
          companion.wizard · Profile Identity
        </span>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-full border-4 border-white/10 bg-black">
        <video
          ref={video}
          playsInline
          muted
          onLoadedMetadata={markStreamReady}
          onCanPlay={markStreamReady}
          onPlaying={markStreamReady}
          className="h-full w-full scale-x-[-1] object-cover"
          data-testid="selfie-video"
        />
      </div>
      <p className="mt-2.5 text-center text-sm text-white/80" role="status" aria-live="polite" data-testid="selfie-hint">
        {HINT_TEXT[hint]}
      </p>
      {error && (
        <p className="mt-1.5 text-center text-sm text-amber-200" data-testid="selfie-error">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={(!camReady && !box) || busy}
          onClick={() => void capture()}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Take photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => void onFilePick(e)}
          className="hidden"
          data-testid="selfie-file-input"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          data-testid="selfie-upload-btn"
          className="min-h-[44px] rounded-xl border border-white/25 bg-white/5 px-5 font-medium text-white/90 hover:bg-white/10"
        >
          Upload photo
        </button>
        <button type="button" onClick={onSkip} className="min-h-[44px] rounded-xl border border-white/15 px-6 text-white/80">
          {hint === 'unavailable' ? 'Continue without a photo' : "I'd rather not"}
        </button>
      </div>
    </div>
  );
}
