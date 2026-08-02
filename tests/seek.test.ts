/**
 * 途中再生（シーク）と、書き出しの頭の無音カット。
 *
 * scheduleArrangement は Web Audio のノードを触るので、
 * 「いつ・どの音を鳴らそうとしたか」だけを記録する偽の音源で確かめる。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { leadingSilenceFrames } from "../src/audio/export";
import { buildArrangement, makeSlot, type Song } from "../src/music/song";
import { DEFAULT_SONG } from "../src/state";

interface Played {
  midi: number;
  time: number;
  dur: number;
}

// vi.mock はファイル先頭へ巻き上げられるので、記録先もこの中で用意する。
vi.mock("../src/audio/instruments", () => {
  const played: Played[] = [];
  const drumHits: number[] = [];
  const fakeVoice = {
    id: "fake",
    label: "fake",
    tail: 1,
    play: (_ctx: unknown, _dest: unknown, midi: number, time: number, dur: number) => {
      played.push({ midi, time, dur });
    },
  };
  return {
    played,
    drumHits,
    getInstrument: () => fakeVoice,
    bassInstrument: fakeVoice,
    instrumentTail: () => 1,
    playDrum: (_ctx: unknown, _dest: unknown, _voice: string, time: number) => {
      drumHits.push(time);
    },
  };
});

const instruments = (await import("../src/audio/instruments")) as unknown as {
  played: Played[];
  drumHits: number[];
};
const played = instruments.played;
const drumHits = instruments.drumHits;

const { scheduleArrangement } = await import("../src/audio/render");

/** buildMasterChain を通さず、バスだけそれらしく用意する。 */
const chain = {
  chordBus: {} as GainNode,
  bassBus: {} as GainNode,
  drumBus: {} as GainNode,
  melodyBus: {} as GainNode,
  master: {} as GainNode,
};

function songWith(patch: Partial<Song>): Song {
  return { ...DEFAULT_SONG, ...patch };
}

/** 4拍のコード2つ、8分のメロディ入り。 */
function sample(): Song {
  return songWith({
    chords: [makeSlot(0, "maj", 4), makeSlot(5, "maj", 4)],
    repeats: 1,
    melodyEnabled: true,
    melodyStepsPerBeat: 2,
    melody: [0, null, 4, null, 7, null, 9, null],
    drumPattern: "rock8",
    bassEnabled: true,
  });
}

function schedule(song: Song, fromBeat: number): number {
  const arr = buildArrangement(song);
  return scheduleArrangement({} as BaseAudioContext, chain, song, arr, 0, fromBeat);
}

beforeEach(() => {
  played.length = 0;
  drumHits.length = 0;
});

describe("途中から再生する", () => {
  it("頭から鳴らすと最初の音が時刻0にくる", () => {
    schedule(sample(), 0);
    expect(played.length).toBeGreaterThan(0);
    expect(Math.min(...played.map((p) => p.time))).toBeCloseTo(0, 6);
  });

  it("指定した拍より前の音は鳴らない", () => {
    schedule(sample(), 4);
    // 途中再生でも、鳴る音は必ず時刻0以降
    expect(played.every((p) => p.time >= -1e-9)).toBe(true);
    expect(drumHits.every((t) => t >= -1e-9)).toBe(true);
  });

  it("途中から始めると鳴らす音が減る", () => {
    schedule(sample(), 0);
    const all = played.length;
    played.length = 0;
    schedule(sample(), 4);
    expect(played.length).toBeLessThan(all);
    expect(played.length).toBeGreaterThan(0);
  });

  it("またいでいる和音は残りの長さだけ鳴る（無音にならない）", () => {
    // 4拍まるごと伸ばすコード1つ。2拍目から再生する。
    const song = songWith({
      chords: [makeSlot(0, "maj", 4)],
      repeats: 1,
      chordPattern: "whole",
      melodyEnabled: false,
      bassEnabled: false,
      drumPattern: "none",
    });
    schedule(song, 2);
    expect(played.length).toBeGreaterThan(0);
    // 頭から鳴り始め、残り2拍ぶんの長さ
    expect(Math.min(...played.map((p) => p.time))).toBeCloseTo(0, 6);
    const spb = buildArrangement(song).secondsPerBeat;
    for (const p of played) expect(p.dur).toBeLessThanOrEqual(2 * spb + 1e-6);
  });

  it("ドラムは途中から叩き直さない（打点が前にずれない）", () => {
    schedule(sample(), 4);
    expect(drumHits.every((t) => t >= -1e-9)).toBe(true);
  });

  it("ほとんど残っていない音は鳴らさない", () => {
    const song = songWith({
      chords: [makeSlot(0, "maj", 4)],
      repeats: 1,
      chordPattern: "whole",
      melodyEnabled: false,
      bassEnabled: false,
      drumPattern: "none",
    });
    const arr = buildArrangement(song);
    // 音の終わりぎりぎり手前から再生する
    const last = arr.chordNotes.reduce((a, b) => (a.start + a.dur > b.start + b.dur ? a : b));
    schedule(song, last.start + last.dur - 0.001);
    expect(played).toHaveLength(0);
  });

  it("残り時間ぶんだけ短くなる", () => {
    const song = sample();
    const full = schedule(song, 0);
    played.length = 0;
    const half = schedule(song, 4);
    const spb = buildArrangement(song).secondsPerBeat;
    expect(full - half).toBeCloseTo(4 * spb, 6);
  });

  it("メロディも途中から鳴る", () => {
    // 伴奏と混ざらないよう、メロディだけ2オクターブ上げて見分ける
    const song = songWith({
      chords: [makeSlot(0, "maj", 4), makeSlot(5, "maj", 4)],
      repeats: 1,
      melodyEnabled: true,
      melodyStepsPerBeat: 2,
      melodyOctave: 2,
      melody: [0, null, null, null, null, null, null, null, 7],
      bassEnabled: false,
      drumPattern: "none",
    });
    const high = () => played.filter((p) => p.midi >= 84).map((p) => p.midi);

    schedule(song, 0);
    expect(high()).toEqual([84, 91]); // 0拍目と4拍目

    played.length = 0;
    schedule(song, 4);
    expect(high()).toEqual([91]); // 4拍目のぶんだけ残る
  });
});

describe("書き出しの頭の無音", () => {
  /** 先頭 silentFrames ぶんが無音で、その後に音が入っているバッファ。 */
  function buffer(silentFrames: number, sampleRate = 44100, total = 44100): AudioBuffer {
    const data = new Float32Array(total);
    for (let i = silentFrames; i < total; i++) data[i] = 0.5 * Math.sin(i / 20);
    return {
      numberOfChannels: 1,
      length: total,
      sampleRate,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
  }

  it("頭に付いた無音を見つける", () => {
    // 1ms ぶんは安全のため残すので、その手前まで
    expect(leadingSilenceFrames(buffer(500))).toBe(500 - 44);
  });

  it("最初から鳴っていれば何も切らない", () => {
    expect(leadingSilenceFrames(buffer(0))).toBe(0);
  });

  it("立ち上がりそのものは削らない", () => {
    const skip = leadingSilenceFrames(buffer(500));
    expect(skip).toBeLessThan(500);
  });

  it("長い無音は曲の一部とみなして切らない", () => {
    // 0.25秒を超える先頭の静けさは、意図した休符かもしれないので触らない
    expect(leadingSilenceFrames(buffer(30000))).toBe(0);
  });

  it("まるごと無音でも壊れない", () => {
    const data = new Float32Array(1000);
    const empty = {
      numberOfChannels: 1,
      length: 1000,
      sampleRate: 44100,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
    expect(leadingSilenceFrames(empty)).toBe(0);
  });
});
