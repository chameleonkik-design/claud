/**
 * オフラインレンダリングと音声ファイルへのエンコード。
 *
 * 1. OfflineAudioContext で曲を丸ごとレンダリング（試聴と同じスケジューラを使う）
 * 2. Float32 の PCM を Int16 に変換
 * 3. lamejs で MP3 に、あるいは自前で WAV ヘッダを付けて WAV に
 *
 * エンコードは 1152 サンプル（MP3のフレーム長）単位で回し、
 * ときどき制御を返して UI が固まらないようにしている。
 */

import { Mp3Encoder } from "@breezystack/lamejs";
import { buildArrangement, type Song } from "../music/song";
import {
  createOfflineAudioContext,
  isAbortError,
  isIosLike,
  needsManualSaveTap,
  pickSaveStrategy,
  type SaveStrategy,
} from "./compat";
import { buildMasterChain, scheduleArrangement, totalRenderSeconds } from "./render";

/** MP3 の 1 フレーム分のサンプル数。 */
const MP3_FRAME = 1152;

export const SAMPLE_RATE = 44100;

export const BITRATES = [128, 192, 256, 320] as const;
export type Bitrate = (typeof BITRATES)[number];

export type ProgressFn = (ratio: number, phase: "render" | "encode") => void;

/** 曲をオフラインでレンダリングして AudioBuffer を得る。 */
export async function renderSong(song: Song, onProgress?: ProgressFn): Promise<AudioBuffer> {
  const arr = buildArrangement(song);
  const seconds = totalRenderSeconds(song, arr);
  const frames = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));

  onProgress?.(0, "render");
  const ctx = createOfflineAudioContext(2, frames, SAMPLE_RATE);
  const chain = buildMasterChain(ctx, ctx.destination, song);
  scheduleArrangement(ctx, chain, song, arr, 0);
  const buffer = await ctx.startRendering();
  onProgress?.(1, "render");
  return buffer;
}

/** Float32 の 1 チャンネルを Int16 に変換（クリップ処理つき）。 */
function toInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = input[i] < -1 ? -1 : input[i] > 1 ? 1 : input[i];
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** イベントループに制御を返す。 */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** AudioBuffer を MP3 の Blob にエンコードする。 */
export async function encodeMp3(
  buffer: AudioBuffer,
  kbps: Bitrate = 192,
  onProgress?: ProgressFn,
): Promise<Blob> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : undefined;

  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const total = left.length;

  // 一度に処理するフレーム数。多すぎると UI が固まり、少なすぎると遅い。
  const framesPerSlice = 64;
  let i = 0;
  while (i < total) {
    for (let f = 0; f < framesPerSlice && i < total; f++) {
      const end = Math.min(i + MP3_FRAME, total);
      const l = left.subarray(i, end);
      const r = right ? right.subarray(i, end) : undefined;
      const data = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
      if (data.length > 0) chunks.push(new Uint8Array(data));
      i = end;
    }
    onProgress?.(i / total, "encode");
    await yieldToUi();
  }

  const rest = encoder.flush();
  if (rest.length > 0) chunks.push(new Uint8Array(rest));
  onProgress?.(1, "encode");

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

/** AudioBuffer を 16bit PCM の WAV Blob にする。 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt チャンクのサイズ
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const data = [];
  for (let ch = 0; ch < channels; ch++) data.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, data[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

/** ブラウザにファイルを保存させる（通常のダウンロード）。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐ revoke するとダウンロードが始まらないブラウザがあるので少し待つ
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** この端末でファイルを共有シートに渡せるか。 */
export function canShareFiles(filename: string, type: string): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    const probe = new File([new Uint8Array([0])], filename, { type });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** この端末で使う保存方法。 */
export function saveStrategyFor(filename: string, type: string): SaveStrategy {
  return pickSaveStrategy({
    ios: typeof navigator !== "undefined" && isIosLike(navigator),
    canShareFiles: canShareFiles(filename, type),
  });
}

/**
 * 書き出しが終わったあと、保存に改めてタップが必要か。
 *
 * iOS では共有シートを使うため、書き出し完了後にユーザーの操作が要る。
 */
export function saveNeedsUserTap(filename: string, type: string): boolean {
  return needsManualSaveTap(saveStrategyFor(filename, type));
}

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

/**
 * ファイルを保存する。
 *
 * iOS Safari は blob URL に対する `<a download>` を無視するので、共有シートに
 * File を渡して「"ファイル"に保存」してもらう。必ずユーザー操作の中から呼ぶこと。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (saveStrategyFor(filename, blob.type) === "share") {
    try {
      await navigator.share({
        files: [new File([blob], filename, { type: blob.type })],
        title: filename,
      });
      return "shared";
    } catch (err) {
      // ユーザーが閉じただけならエラー扱いしない
      if (isAbortError(err)) return "cancelled";
      // 共有できなかった場合は通常のダウンロードへ落とす
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

/** ファイル名に使えない文字を落とす。 */
export function safeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "chord-progression"
  );
}
