/**
 * 試聴用の再生コントローラ。
 *
 * AudioContext は1つだけ作って使い回す（ブラウザの自動再生制限は
 * 「最初の再生ボタンのクリック」で解除される）。
 */

import { buildArrangement, type Arrangement, type Song } from "../music/song";
import { createAudioContext } from "./compat";
import { getInstrument } from "./instruments";
import { buildMasterChain, scheduleArrangement, type MasterChain } from "./render";

export interface PlayPosition {
  /** 曲頭からの拍位置（ループ時はループ内の位置）。 */
  beat: number;
  /** ループ内のコードのインデックス。 */
  chordIndex: number;
}

export class Player {
  private ctx: AudioContext | null = null;
  private chain: MasterChain | null = null;
  private arr: Arrangement | null = null;
  private startTime = 0;
  /** ループの先頭にあたる時刻（途中再生でも beat 0 の基準になる）。 */
  private loopOrigin = 0;
  private loop = false;
  private loopSeconds = 0;
  private scheduledUntilLoop = 0;
  private timer: number | null = null;
  private song: Song | null = null;

  /** 再生中かどうか。 */
  playing = false;

  /** 再生が自然に終了したときに呼ばれる。 */
  onEnded: (() => void) | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = createAudioContext();
    }
    return this.ctx;
  }

  /** ブラウザの自動再生ポリシー解除のため、ユーザー操作の中で呼ぶ。 */
  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  /**
   * 録音などで使い回すための AudioContext。
   * ユーザー操作の中で呼ぶこと（iOS は操作なしでは再開できない）。
   */
  async audioContext(): Promise<AudioContext> {
    await this.unlock();
    return this.ensureContext();
  }

  /**
   * 再生する。fromBeat を渡すとその拍から始まる（ループ内の拍位置）。
   * 長い曲を作っているときに、頭から聴き直さずに確認できる。
   */
  async play(song: Song, loop: boolean, fromBeat = 0): Promise<void> {
    this.stop();
    await this.unlock();
    const ctx = this.ensureContext();

    // ループ時は1周分だけ組んで、継ぎ目で次の周を予約していく。
    const source: Song = loop ? { ...song, repeats: 1 } : song;
    const arr = buildArrangement(source);
    const chain = buildMasterChain(ctx, ctx.destination, source);

    const totalBeats = loop ? arr.beatsPerLoop : arr.beatsPerLoop * source.repeats;
    // 端ちょうどを指すと1音も鳴らないので、頭に戻す
    const from = fromBeat > 0 && fromBeat < totalBeats - 1e-6 ? fromBeat : 0;

    this.song = source;
    this.arr = arr;
    this.chain = chain;
    this.loop = loop;
    this.loopSeconds = arr.beatsPerLoop * arr.secondsPerBeat;
    // 少し先の時刻から始めることで、スケジューリングの遅れによる頭欠けを防ぐ
    this.startTime = ctx.currentTime + 0.12;
    // 「ループの先頭が鳴っていたはずの時刻」。2周目以降と再生位置の計算に使う。
    this.loopOrigin = this.startTime - from * arr.secondsPerBeat;
    this.playing = true;

    const soundEnd = scheduleArrangement(ctx, chain, source, arr, this.startTime, from);
    this.scheduledUntilLoop = 1;

    if (loop) {
      // 先読みして次の周を予約し続ける
      this.timer = window.setInterval(() => this.pump(), 200);
    } else {
      this.timer = window.setTimeout(() => {
        this.stop();
        this.onEnded?.();
      }, (soundEnd + 0.12) * 1000);
    }
  }

  /** ループ再生の先読みスケジューリング。 */
  private pump(): void {
    if (!this.ctx || !this.chain || !this.arr || !this.song || !this.loop) return;
    const ahead = 1.5;
    // 2周目以降はループの頭から丸ごと鳴らす
    while (
      this.loopOrigin + this.scheduledUntilLoop * this.loopSeconds <
      this.ctx.currentTime + ahead
    ) {
      scheduleArrangement(
        this.ctx,
        this.chain,
        this.song,
        this.arr,
        this.loopOrigin + this.scheduledUntilLoop * this.loopSeconds,
      );
      this.scheduledUntilLoop += 1;
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = null;
    }
    const chain = this.chain;
    const ctx = this.ctx;
    if (chain && ctx) {
      // 急に切るとプツッと鳴るので、ごく短くフェードしてから切り離す。
      const now = ctx.currentTime;
      try {
        chain.master.gain.cancelScheduledValues(now);
        chain.master.gain.setValueAtTime(chain.master.gain.value, now);
        chain.master.gain.linearRampToValueAtTime(0, now + 0.06);
      } catch {
        // 既に切断済みなどのケースは無視してよい
      }
      window.setTimeout(() => {
        try {
          chain.master.disconnect();
        } catch {
          /* noop */
        }
      }, 120);
    }
    this.chain = null;
    this.arr = null;
    this.song = null;
    this.playing = false;
  }

  /** ループ内の拍位置から、鳴っているコードを引く。 */
  private chordIndexAt(beat: number): number {
    const chords = this.arr?.chords ?? [];
    if (chords.length === 0) return 0;
    const inLoop = beat % (this.arr?.beatsPerLoop || 1);
    for (let i = 0; i < chords.length; i++) {
      if (inLoop < chords[i].startBeat + chords[i].beats - 1e-9) return i;
    }
    return chords.length - 1;
  }

  /** 現在の再生位置。停止中は null。 */
  position(): PlayPosition | null {
    if (!this.playing || !this.ctx || !this.arr) return null;
    // 途中再生でも「ループの何拍目か」で見たいので、基準は loopOrigin
    const elapsed = this.ctx.currentTime - this.loopOrigin;
    if (this.ctx.currentTime < this.startTime) {
      const pending = (this.startTime - this.loopOrigin) / this.arr.secondsPerBeat;
      return { beat: pending, chordIndex: this.chordIndexAt(pending) };
    }

    const beatsTotal = elapsed / this.arr.secondsPerBeat;
    const loopBeats = this.arr.beatsPerLoop;
    const beat = this.loop ? beatsTotal % loopBeats : beatsTotal;
    return { beat, chordIndex: this.chordIndexAt(beat) };
  }

  /** 単発でコードを試し聴きする（パレットのプレビュー用）。 */
  async preview(song: Song, notes: number[]): Promise<void> {
    await this.unlock();
    const ctx = this.ensureContext();
    const chain = buildMasterChain(ctx, ctx.destination, song);
    const inst = getInstrument(song.instrument);
    const t = ctx.currentTime + 0.02;
    notes.forEach((midi, i) => {
      inst.play(ctx, chain.chordBus, midi, t + i * 0.01, 1.1, 0.7);
    });
    window.setTimeout(
      () => {
        try {
          chain.master.disconnect();
        } catch {
          /* noop */
        }
      },
      (1.1 + inst.tail) * 1000 + 200,
    );
  }
}
