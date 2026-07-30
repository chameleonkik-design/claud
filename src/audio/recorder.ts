/**
 * MediaRecorder を使って、ブラウザ内蔵のエンコーダで音声ファイルを作る。
 *
 * なぜ lamejs の MP3 ではなくこれが必要か:
 * 埋め込み表示（iframe）の中では通常のダウンロードが塞がれるため、Artifact
 * ランタイムの保存機能を通すしかない。ところがそこで許可される音声の拡張子は
 * mp4 / webm だけで、mp3 も wav も渡せない。
 *
 * MediaRecorder なら Safari では AAC 入り MP4、Chrome では Opus 入り WebM を
 * 作れる。どちらも許可されている形式で、自前でコンテナを書く必要もない。
 *
 * 代償として録音は実時間かかる（40秒の曲なら40秒）。オフラインレンダリングは
 * 一瞬で終わるので、そこは今までどおり OfflineAudioContext で作ってから、
 * できた音を無音のまま流し込んで録る。
 */

export type MediaExtension = "mp4" | "webm";

export interface RecorderFormat {
  mime: string;
  extension: MediaExtension;
  /** UI に出す形式名。 */
  label: string;
}

/**
 * 優先順に試す形式。
 * MP4（AAC）を最優先にしているのは、iPhone の「ファイル」アプリと
 * ミュージックアプリがそのまま再生できるため。
 */
const CANDIDATES: RecorderFormat[] = [
  { mime: 'audio/mp4;codecs="mp4a.40.2"', extension: "mp4", label: "MP4（AAC）" },
  { mime: "audio/mp4", extension: "mp4", label: "MP4（AAC）" },
  { mime: "audio/webm;codecs=opus", extension: "webm", label: "WebM（Opus）" },
  { mime: "audio/webm", extension: "webm", label: "WebM" },
];

/** この端末で使える録音形式。使えなければ null。 */
export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
    } catch {
      // isTypeSupported が例外を投げる実装もあるので次の候補へ
    }
  }
  return null;
}

export interface RecordResult {
  blob: Blob;
  format: RecorderFormat;
}

/**
 * レンダリング済みの AudioBuffer を録音してファイルにする。
 *
 * ctx はユーザー操作で resume 済みの AudioContext を渡すこと
 * （iOS は操作を伴わないと音声処理が始まらない）。
 */
export async function recordBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  onProgress?: (ratio: number) => void,
): Promise<RecordResult> {
  const format = pickRecorderFormat();
  if (!format) {
    throw new Error("このブラウザは音声ファイルの作成（MediaRecorder）に対応していません。");
  }

  const destination = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // スピーカーには繋がない。録音中に音が鳴らないようにするため。
  source.connect(destination);

  const recorder = new MediaRecorder(destination.stream, { mimeType: format.mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("録音中にエラーが発生しました。"));
  });

  const startedAt = ctx.currentTime;
  recorder.start(250);
  source.start();

  let progressTimer = 0;
  if (onProgress) {
    onProgress(0);
    progressTimer = window.setInterval(() => {
      const ratio = (ctx.currentTime - startedAt) / buffer.duration;
      onProgress(Math.max(0, Math.min(0.999, ratio)));
    }, 200);
  }

  // 再生の終了を待つ。タブが裏に回って AudioContext が止まると onended が
  // 来ないことがあるので、余裕を持った上限で打ち切る。
  const safetyMs = (buffer.duration * 1.5 + 10) * 1000;
  await Promise.race([
    new Promise<void>((resolve) => {
      source.onended = () => resolve();
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, safetyMs)),
  ]);

  // 末尾の余韻が切れないよう、少し待ってから止める
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  recorder.stop();
  await stopped;

  window.clearInterval(progressTimer);
  onProgress?.(1);
  source.disconnect();

  return { blob: new Blob(chunks, { type: format.mime }), format };
}
