/**
 * The selfie's face gate (server docs/reading-engine/52 §4): MediaPipe's short-range face detector, served from our own
 * static files (public/mediapipe), runs on each video frame. Capture is allowed only after 10 frames in a row with
 * exactly one face, at least 25 % of the frame wide, centred in the middle 60 %, confidence ≥ 0.7.
 */
import type { FaceBox } from './profileApi';

export type GateHint = 'loading' | 'no_face' | 'many_faces' | 'too_far' | 'off_centre' | 'hold_still' | 'ready' | 'unavailable';

export const HINT_TEXT: Record<GateHint, string> = {
  loading: 'Getting the camera ready…',
  no_face: 'Look at the camera',
  many_faces: 'Only you in the frame',
  too_far: 'Move a little closer',
  off_centre: 'Centre your face',
  hold_still: 'Hold still…',
  ready: 'Looks good',
  unavailable: 'The camera is not available here',
};

export const STEADY_FRAMES = 10;

export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

/** One frame's verdict from its detections (fractions of the frame). */
export function judgeFrame(dets: Detection[]): { hint: Exclude<GateHint, 'loading' | 'hold_still' | 'ready' | 'unavailable'> | 'ok'; box?: FaceBox } {
  const faces = dets.filter((d) => d.score >= 0.7);
  if (faces.length === 0) return { hint: 'no_face' };
  if (faces.length > 1) return { hint: 'many_faces' };
  const f = faces[0]!;
  if (f.w < 0.25) return { hint: 'too_far' };
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  if (cx < 0.2 || cx > 0.8 || cy < 0.2 || cy > 0.8) return { hint: 'off_centre' };
  return { hint: 'ok', box: { x: f.x, y: f.y, w: f.w, h: f.h, score: f.score } };
}

/** Counts consecutive good frames; ready once there are STEADY_FRAMES of them. */
export class Steadiness {
  private run = 0;
  push(ok: boolean): boolean {
    this.run = ok ? this.run + 1 : 0;
    return this.run >= STEADY_FRAMES;
  }
  get count(): number {
    return this.run;
  }
}

export interface FaceDetectorLike {
  detectForVideo(video: HTMLVideoElement, t: number): { detections: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: Array<{ score: number }> }> };
  close(): void;
}

/** Loads MediaPipe's detector from /mediapipe; null when the browser cannot run it. */
export async function loadDetector(): Promise<FaceDetectorLike | null> {
  try {
    const pkg = '@mediapipe/tasks-vision';
    const vision = await import(/* @vite-ignore */ pkg);
    const files = await vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
    return (await vision.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate: 'GPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })) as unknown as FaceDetectorLike;
  } catch {
    return null;
  }
}

/** The detector's boxes in pixels, as fractions of the video frame. */
export function toFractions(raw: ReturnType<FaceDetectorLike['detectForVideo']>, width: number, height: number): Detection[] {
  return raw.detections
    .filter((d) => d.boundingBox)
    .map((d) => ({ x: d.boundingBox!.originX / width, y: d.boundingBox!.originY / height, w: d.boundingBox!.width / width, h: d.boundingBox!.height / height, score: d.categories?.[0]?.score ?? 0 }));
}
