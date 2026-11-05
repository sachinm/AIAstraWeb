// Copies MediaPipe's wasm runtime from node_modules into public/mediapipe/wasm so the selfie face gate is served by the
// app itself (docs/reading-engine/52 §4). The wasm (about 9 MB each) is not committed; the face model is.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const from = 'node_modules/@mediapipe/tasks-vision/wasm';
const to = 'public/mediapipe/wasm';
if (!existsSync(from)) {
  console.warn('[mediapipe] node_modules/@mediapipe/tasks-vision is missing; the selfie face gate will fall back to skip');
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}
