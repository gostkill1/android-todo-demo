// 生成通知音 ding.wav（三个正弦分音 + 指数衰减 ≈ 一声「叮」），输出到安卓的 res/raw。
// 换声音：改 PARTIALS/TAU/SECONDS 再跑一次 `node make-sound.mjs`，然后重新 assembleRelease。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const SECONDS = 0.8;
const TAU = 0.15;
const PARTIALS = [[1046.5, 1], [1568.0, 0.42], [2093.0, 0.26]];

const total = Math.floor(RATE * SECONDS);
const samples = new Float64Array(total);
let peak = 0;
for (let i = 0; i < total; i += 1) {
  const t = i / RATE;
  let value = 0;
  for (const [freq, amp] of PARTIALS) value += amp * Math.sin(2 * Math.PI * freq * t);
  value *= Math.exp(-t / TAU) * Math.min(1, t / 0.004);
  samples[i] = value;
  peak = Math.max(peak, Math.abs(value));
}

const pcm = Buffer.alloc(total * 2);
const gain = peak ? 0.85 / peak : 0;
for (let i = 0; i < total; i += 1) {
  const clamped = Math.max(-1, Math.min(1, samples[i] * gain));
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = join(dirname(fileURLToPath(import.meta.url)), 'android', 'app', 'src', 'main', 'res', 'raw', 'ding.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`${out}\n${SECONDS}s · ${RATE} Hz · 单声道 · ${pcm.length + 44} 字节`);
