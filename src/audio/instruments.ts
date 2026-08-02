/**
 * Web Audio API による簡易シンセ音源。
 *
 * 外部サンプルを一切使わないので、オフラインでも即座に鳴り、
 * OfflineAudioContext での書き出しも同じコードパスで動く。
 *
 * すべての関数は「与えられた time にノードを組んでスケジュールするだけ」で、
 * ctx が AudioContext か OfflineAudioContext かを気にしない。
 */

import { midiToFreq } from "../music/notes";
import type { DrumVoice } from "../music/patterns";

const MIN_GAIN = 0.0001;

/** ホワイトノイズのバッファをコンテキストごとにキャッシュする。 */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // 決定論的な擬似乱数。試聴と書き出しで同じ波形になるようにしている。
  let seed = 0x2f6e2b1;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

/** 打楽器・撥弦系のエンベロープ: 立ち上がってから指数的に減衰。 */
function percEnv(
  param: AudioParam,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  param.setValueAtTime(MIN_GAIN, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(MIN_GAIN, t + attack + decay);
}

/** 持続音のエンベロープ: A-D-S-R。 */
function adsrEnv(
  param: AudioParam,
  t: number,
  dur: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
): void {
  const sustainLevel = Math.max(MIN_GAIN, peak * sustain);
  const holdEnd = t + Math.max(attack + decay, dur);
  param.setValueAtTime(MIN_GAIN, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(sustainLevel, t + attack + decay);
  param.setValueAtTime(sustainLevel, holdEnd);
  param.exponentialRampToValueAtTime(MIN_GAIN, holdEnd + release);
}

export interface Instrument {
  id: string;
  label: string;
  /** この音色を単音鳴らす。 */
  play(
    ctx: BaseAudioContext,
    dest: AudioNode,
    midi: number,
    time: number,
    dur: number,
    vel: number,
  ): void;
  /** 発音後に残る余韻の長さ（秒）。書き出し長の計算に使う。 */
  tail: number;
}

/** 基本波形を1つ鳴らすだけのヘルパ。 */
function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  time: number,
  stop: number,
  detune = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (detune) o.detune.value = detune;
  o.start(time);
  o.stop(stop);
  return o;
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: "piano",
    label: "ピアノ",
    tail: 2.2,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const out = ctx.createGain();
      out.gain.value = 1;
      out.connect(dest);

      // 倍音ごとに減衰速度を変えると、それらしいアタックと減衰になる。
      const partials: Array<[mult: number, level: number, decay: number]> = [
        [1, 0.55, 2.0],
        [2, 0.22, 1.2],
        [3, 0.1, 0.7],
        [4, 0.06, 0.45],
        [5.02, 0.03, 0.3],
      ];
      const decayScale = Math.max(0.45, Math.min(1.6, 1.6 - (midi - 48) / 60));
      const stop = time + Math.max(dur, 0.2) + 2.2;

      for (const [mult, level, decay] of partials) {
        const g = ctx.createGain();
        const o = osc(ctx, "sine", freq * mult, time, stop);
        percEnv(g.gain, time, level * vel, 0.003, decay * decayScale);
        o.connect(g).connect(out);
      }

      // 打鍵のノイズ成分
      const click = ctx.createBufferSource();
      click.buffer = noiseBuffer(ctx);
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = "bandpass";
      clickFilter.frequency.value = Math.min(6000, freq * 6);
      clickFilter.Q.value = 0.9;
      const clickGain = ctx.createGain();
      percEnv(clickGain.gain, time, 0.05 * vel, 0.001, 0.05);
      click.start(time);
      click.stop(time + 0.1);
      click.connect(clickFilter).connect(clickGain).connect(out);
    },
  },
  {
    id: "epiano",
    label: "エレピ",
    tail: 2.4,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.2) + 2.4;
      const out = ctx.createGain();
      out.connect(dest);

      // FM: モジュレータの深さを速く減衰させると鐘っぽいアタックになる。
      const carrier = osc(ctx, "sine", freq, time, stop);
      const mod = osc(ctx, "sine", freq * 14, time, stop);
      const modGain = ctx.createGain();
      percEnv(modGain.gain, time, freq * 2.2 * vel, 0.002, 0.35);
      mod.connect(modGain).connect(carrier.frequency);

      const g = ctx.createGain();
      percEnv(g.gain, time, 0.5 * vel, 0.004, 1.9);
      carrier.connect(g).connect(out);

      // 下支えの基音
      const sub = osc(ctx, "triangle", freq, time, stop);
      const subGain = ctx.createGain();
      percEnv(subGain.gain, time, 0.18 * vel, 0.006, 1.4);
      sub.connect(subGain).connect(out);
    },
  },
  {
    id: "pad",
    label: "パッド",
    tail: 3.0,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.3) + 3.0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(700, freq * 2), time);
      filter.frequency.linearRampToValueAtTime(Math.min(4200, freq * 7), time + 1.2);
      filter.Q.value = 0.7;

      const g = ctx.createGain();
      adsrEnv(g.gain, time, dur, 0.32 * vel, 0.35, 0.6, 0.75, 1.6);
      filter.connect(g).connect(dest);

      for (const detune of [-9, 0, 9]) {
        osc(ctx, "sawtooth", freq, time, stop, detune).connect(filter);
      }
      osc(ctx, "sine", freq / 2, time, stop).connect(filter);
    },
  },
  {
    id: "organ",
    label: "オルガン",
    tail: 0.5,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.1) + 0.5;
      const out = ctx.createGain();
      adsrEnv(out.gain, time, dur, 0.34 * vel, 0.012, 0.08, 0.92, 0.12);
      out.connect(dest);

      // ドローバー風の倍音構成
      const drawbars: Array<[number, number]> = [
        [0.5, 0.3],
        [1, 1],
        [2, 0.55],
        [3, 0.28],
        [4, 0.2],
        [6, 0.12],
        [8, 0.08],
      ];
      for (const [mult, level] of drawbars) {
        const g = ctx.createGain();
        g.gain.value = level * 0.4;
        osc(ctx, "sine", freq * mult, time, stop).connect(g).connect(out);
      }
    },
  },
  {
    id: "pluck",
    label: "ギター（撥弦）",
    tail: 1.6,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.15) + 1.6;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(9000, freq * 9), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.6), time + 0.7);
      filter.Q.value = 1.1;

      const g = ctx.createGain();
      percEnv(g.gain, time, 0.42 * vel, 0.004, 1.5);
      filter.connect(g).connect(dest);

      osc(ctx, "sawtooth", freq, time, stop).connect(filter);
      const tri = ctx.createGain();
      tri.gain.value = 0.5;
      osc(ctx, "triangle", freq, time, stop, 6).connect(tri).connect(filter);

      // 弦を弾く瞬間のノイズ
      const pick = ctx.createBufferSource();
      pick.buffer = noiseBuffer(ctx);
      const pickHp = ctx.createBiquadFilter();
      pickHp.type = "highpass";
      pickHp.frequency.value = 2000;
      const pickGain = ctx.createGain();
      percEnv(pickGain.gain, time, 0.08 * vel, 0.001, 0.04);
      pick.start(time);
      pick.stop(time + 0.08);
      pick.connect(pickHp).connect(pickGain).connect(dest);
    },
  },
  {
    id: "strings",
    label: "ストリングス",
    tail: 1.8,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.3) + 1.8;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = Math.min(5000, freq * 8);

      const g = ctx.createGain();
      adsrEnv(g.gain, time, dur, 0.24 * vel, 0.16, 0.3, 0.85, 0.7);
      filter.connect(g).connect(dest);

      // わずかなビブラート
      const lfo = osc(ctx, "sine", 5.2, time, stop);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.006;
      lfo.connect(lfoGain);

      for (const detune of [-14, -5, 5, 14]) {
        const o = osc(ctx, "sawtooth", freq, time, stop, detune);
        lfoGain.connect(o.frequency);
        const og = ctx.createGain();
        og.gain.value = 0.3;
        o.connect(og).connect(filter);
      }
    },
  },
  {
    id: "musicbox",
    label: "オルゴール",
    tail: 3.2,
    play(ctx, dest, midi, time, dur, vel) {
      const freq = midiToFreq(midi);
      const stop = time + Math.max(dur, 0.1) + 3.2;
      const out = ctx.createGain();
      out.connect(dest);
      // 倍音の比。2.76 や 5.4 のような中途半端な比を強く鳴らすと、
      // 和音に混ざったとき濁って聞こえる。基音とオクターブ・12度を主体にして、
      // 金属的な高い倍音は「カン」と鳴る一瞬だけ、ごく小さく混ぜる。
      const partials: Array<[number, number, number]> = [
        [1, 0.5, 3.0],
        [2, 0.12, 1.6],
        [3, 0.05, 0.9],
        [6.27, 0.03, 0.35],
        [9.1, 0.012, 0.2],
      ];
      for (const [mult, level, decay] of partials) {
        const g = ctx.createGain();
        percEnv(g.gain, time, level * vel, 0.002, decay);
        osc(ctx, "sine", freq * mult, time, stop).connect(g).connect(out);
      }
    },
  },
];

const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));

export function getInstrument(id: string): Instrument {
  return INSTRUMENT_BY_ID.get(id) ?? INSTRUMENTS[0];
}

/** ベース音源（固定）。 */
export const bassInstrument: Instrument = {
  id: "bass",
  label: "ベース",
  tail: 0.8,
  play(ctx, dest, midi, time, dur, vel) {
    const freq = midiToFreq(midi);
    const stop = time + Math.max(dur, 0.1) + 0.8;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(2600, freq * 8), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 2.4), time + 0.25);
    filter.Q.value = 1.4;

    const g = ctx.createGain();
    adsrEnv(g.gain, time, Math.min(dur, 1.2), 0.5 * vel, 0.008, 0.18, 0.6, 0.14);
    filter.connect(g).connect(dest);

    osc(ctx, "sawtooth", freq, time, stop).connect(filter);
    const sub = ctx.createGain();
    sub.gain.value = 0.9;
    osc(ctx, "sine", freq, time, stop).connect(sub).connect(filter);
  },
};

/** ドラム1発をスケジュールする。 */
export function playDrum(
  ctx: BaseAudioContext,
  dest: AudioNode,
  voice: DrumVoice,
  time: number,
  vel: number,
): void {
  switch (voice) {
    case "kick": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, time);
      o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
      const g = ctx.createGain();
      percEnv(g.gain, time, 0.9 * vel, 0.002, 0.3);
      o.start(time);
      o.stop(time + 0.4);
      o.connect(g).connect(dest);

      // アタックのクリック
      const click = ctx.createOscillator();
      click.type = "triangle";
      click.frequency.value = 900;
      const cg = ctx.createGain();
      percEnv(cg.gain, time, 0.12 * vel, 0.001, 0.02);
      click.start(time);
      click.stop(time + 0.05);
      click.connect(cg).connect(dest);
      break;
    }
    case "snare": {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1900;
      bp.Q.value = 0.7;
      const ng = ctx.createGain();
      percEnv(ng.gain, time, 0.5 * vel, 0.001, 0.16);
      n.start(time);
      n.stop(time + 0.3);
      n.connect(bp).connect(ng).connect(dest);

      // 胴鳴り
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(160, time + 0.1);
      const bg = ctx.createGain();
      percEnv(bg.gain, time, 0.22 * vel, 0.001, 0.1);
      body.start(time);
      body.stop(time + 0.2);
      body.connect(bg).connect(dest);
      break;
    }
    case "hat": {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 8500;
      const g = ctx.createGain();
      percEnv(g.gain, time, 0.32 * vel, 0.001, 0.05);
      n.start(time);
      n.stop(time + 0.12);
      n.connect(hp).connect(g).connect(dest);
      break;
    }
    case "ride": {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 5200;
      const bp = ctx.createBiquadFilter();
      bp.type = "peaking";
      bp.frequency.value = 7200;
      bp.gain.value = 6;
      const g = ctx.createGain();
      percEnv(g.gain, time, 0.22 * vel, 0.002, 0.42);
      n.start(time);
      n.stop(time + 0.6);
      n.connect(hp).connect(bp).connect(g).connect(dest);
      break;
    }
  }
}

/** 一番長い余韻（書き出し尺の余白計算に使う）。 */
export function instrumentTail(instrumentId: string): number {
  return Math.max(getInstrument(instrumentId).tail, bassInstrument.tail);
}
