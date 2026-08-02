/**
 * アレンジを実際のオーディオグラフに配置する。
 *
 * この関数は AudioContext（試聴）でも OfflineAudioContext（書き出し）でも
 * 同じように動く。試聴とMP3が同一の音になるのはここを共有しているから。
 */

import type { Arrangement, Song } from "../music/song";
import type { Instrument } from "./instruments";
import {
  bassInstrument,
  getInstrument,
  instrumentTail,
  playDrum,
} from "./instruments";

export interface MasterChain {
  chordBus: GainNode;
  bassBus: GainNode;
  drumBus: GainNode;
  melodyBus: GainNode;
  master: GainNode;
}

/** ノイズから残響用インパルス応答を生成する（外部ファイル不要）。 */
function makeImpulse(ctx: BaseAudioContext, seconds = 2.0, decay = 3.2): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 0x9e3779b9;
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = (seed / 0xffffffff) * 2 - 1;
      // 立ち上がりを少しなまらせて、指数的に減衰させる
      const t = i / len;
      const attack = Math.min(1, i / (ctx.sampleRate * 0.01));
      data[i] = noise * attack * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

/**
 * 共通のマスターチェーンを組む。
 *
 *   各パートのバス → (dry + reverb) → グルーコンプ → リミッター → マスター音量 → 出力
 *
 * バスのレベルは、いちばん厚くなる音色・パターン・リバーブ全開の組み合わせでも
 * 0dBFS に当たらない値に決めてある。そのうえでリミッターを保険に置いているので、
 * 書き出した MP3 / WAV がクリップして歪むことはない。
 */
export function buildMasterChain(
  ctx: BaseAudioContext,
  destination: AudioNode,
  song: Song,
): MasterChain {
  const master = ctx.createGain();
  master.gain.value = song.volume;
  master.connect(destination);

  // 保険のリミッター。通常の音量では殆ど効かず、突発的なピークだけ抑える。
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.06;
  limiter.connect(master);

  // 全体をまとめるための緩いコンプ。
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.006;
  comp.release.value = 0.18;
  comp.connect(limiter);

  const mix = ctx.createGain();
  mix.connect(comp);

  const dry = ctx.createGain();
  dry.gain.value = 1 - song.reverb * 0.35;
  dry.connect(mix);

  const wet = ctx.createGain();
  wet.gain.value = song.reverb * 0.9;
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx);
  conv.connect(wet).connect(mix);

  /** パートごとのバスを作る。sendToReverb で残響量を調整。 */
  const bus = (level: number, sendToReverb: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(dry);
    if (song.reverb > 0 && sendToReverb > 0) {
      const send = ctx.createGain();
      send.gain.value = sendToReverb;
      g.connect(send).connect(conv);
    }
    return g;
  };

  return {
    chordBus: bus(0.6, 1),
    // ベースに残響を掛けすぎると低域が濁るので控えめに
    bassBus: bus(0.58, 0.2),
    drumBus: bus(0.55, 0.35),
    // メロディは主役なので、伴奏より少し前に出す
    melodyBus: bus(0.72 * song.melodyVolume, 0.8),
    master,
  };
}

/**
 * アレンジをグラフに書き込む。startTime は ctx.currentTime 基準の開始時刻。
 *
 * fromBeat を渡すと、その拍から始まったものとして書き込む（途中再生）。
 * またいでいる音は残りの長さだけ鳴らすので、和音が途切れて聞こえない。
 * ドラムは打点なので、途中から叩き直すと不自然になる。鳴らさない。
 *
 * 戻り値は「音が完全に消えるまでの秒数」。
 */
export function scheduleArrangement(
  ctx: BaseAudioContext,
  chain: MasterChain,
  song: Song,
  arr: Arrangement,
  startTime: number,
  fromBeat = 0,
): number {
  const inst = getInstrument(song.instrument);
  const melodyInst = getInstrument(song.melodyInstrument);
  const spb = arr.secondsPerBeat;

  /** fromBeat 以降に残っている部分だけを鳴らす。 */
  const playFrom = (
    voice: Instrument,
    dest: GainNode,
    n: { midi: number; start: number; dur: number; vel: number },
  ): void => {
    const end = n.start + n.dur;
    if (end <= fromBeat) return;
    const start = Math.max(n.start, fromBeat);
    const dur = end - start;
    // ほとんど残っていない音を鳴らすと、ただのノイズになる
    if (dur * spb < 0.02) return;
    voice.play(ctx, dest, n.midi, startTime + (start - fromBeat) * spb, dur * spb, n.vel);
  };

  for (const n of arr.chordNotes) playFrom(inst, chain.chordBus, n);
  for (const n of arr.bassNotes) playFrom(bassInstrument, chain.bassBus, n);
  for (const n of arr.melodyNotes) playFrom(melodyInst, chain.melodyBus, n);

  for (const d of arr.drums) {
    if (d.start < fromBeat) continue;
    playDrum(ctx, chain.drumBus, d.voice, startTime + (d.start - fromBeat) * spb, d.vel);
  }

  return arr.durationSeconds - fromBeat * spb + instrumentTail(song.instrument);
}

/** 書き出しに必要な長さ（秒）。余韻ぶんの余白を含む。 */
export function totalRenderSeconds(song: Song, arr: Arrangement): number {
  // メロディの音色の方が余韻が長いこともあるので、長い方に合わせる
  const longest = Math.max(
    instrumentTail(song.instrument),
    song.melodyEnabled ? instrumentTail(song.melodyInstrument) : 0,
  );
  const tail = song.tail ? longest + song.reverb * 2.0 : 0.35;
  return arr.durationSeconds + tail;
}
