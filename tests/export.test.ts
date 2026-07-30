import { describe, expect, it } from "vitest";

import { encodeMp3, encodeWav, safeFilename } from "../src/audio/export";

/**
 * AudioBuffer は Node には無いので、encodeWav / encodeMp3 が実際に使う
 * プロパティだけを持つ最小のスタブを用意する。
 */
function fakeBuffer(seconds: number, sampleRate = 44100, channels = 2): AudioBuffer {
  const length = Math.floor(seconds * sampleRate);
  const data: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const arr = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      // 440Hz のサイン波。左右でわずかに位相をずらしておく。
      arr[i] = 0.4 * Math.sin((2 * Math.PI * 440 * i) / sampleRate + ch * 0.5);
    }
    data.push(arr);
  }
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
}

/** DataView で読むためのヘルパ。 */
async function bytes(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

const ascii = (view: DataView, offset: number, len: number) =>
  Array.from({ length: len }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("");

describe("WAV 書き出し", () => {
  it("正しい RIFF/WAVE ヘッダを持つ", async () => {
    const buffer = fakeBuffer(0.5);
    const blob = encodeWav(buffer);
    expect(blob.type).toBe("audio/wav");

    const v = await bytes(blob);
    expect(ascii(v, 0, 4)).toBe("RIFF");
    expect(ascii(v, 8, 4)).toBe("WAVE");
    expect(ascii(v, 12, 4)).toBe("fmt ");
    expect(ascii(v, 36, 4)).toBe("data");

    expect(v.getUint32(16, true)).toBe(16); // fmt チャンクのサイズ
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(2); // ステレオ
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16); // 16bit

    // ヘッダ 44 バイト + 16bit ステレオのデータ
    const expectedData = buffer.length * 2 * 2;
    expect(v.byteLength).toBe(44 + expectedData);
    expect(v.getUint32(4, true)).toBe(36 + expectedData);
    expect(v.getUint32(40, true)).toBe(expectedData);
    expect(v.getUint32(28, true)).toBe(44100 * 4); // バイト/秒
  });

  it("無音でない波形が実際に書き込まれている", async () => {
    const v = await bytes(encodeWav(fakeBuffer(0.2)));
    let peak = 0;
    for (let off = 44; off + 1 < v.byteLength; off += 2) {
      peak = Math.max(peak, Math.abs(v.getInt16(off, true)));
    }
    // 振幅 0.4 なら 0x7fff * 0.4 ≒ 13100 前後
    expect(peak).toBeGreaterThan(10000);
    expect(peak).toBeLessThanOrEqual(0x7fff);
  });

  it("1に近い値でもクリップして破綻しない", async () => {
    const buf = fakeBuffer(0.05, 44100, 1);
    const data = buf.getChannelData(0);
    data.fill(2.5);
    const v = await bytes(encodeWav(buf));
    expect(v.getInt16(44, true)).toBe(0x7fff);

    data.fill(-2.5);
    const v2 = await bytes(encodeWav(buf));
    expect(v2.getInt16(44, true)).toBe(-0x8000);
  });

  it("モノラルでもヘッダが正しい", async () => {
    const v = await bytes(encodeWav(fakeBuffer(0.1, 44100, 1)));
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(32, true)).toBe(2); // ブロックアライン = 1ch × 2byte
  });
});

describe("MP3 書き出し", () => {
  it("MP3 のフレームヘッダで始まるデータを返す", async () => {
    const blob = await encodeMp3(fakeBuffer(1.0), 192);
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBeGreaterThan(1000);

    const v = await bytes(blob);
    // MPEG のフレーム同期ワードは 11 ビットの 1（0xFF 0xEx 以上）
    expect(v.getUint8(0)).toBe(0xff);
    expect(v.getUint8(1) & 0xe0).toBe(0xe0);
  });

  it("ビットレートを上げるとファイルが大きくなる", async () => {
    const buffer = fakeBuffer(1.0);
    const low = await encodeMp3(buffer, 128);
    const high = await encodeMp3(buffer, 320);
    expect(high.size).toBeGreaterThan(low.size);
  });

  it("長さに応じたサイズになる（192kbps ≒ 24KB/秒）", async () => {
    const blob = await encodeMp3(fakeBuffer(2.0), 192);
    const expected = (192 * 1000 * 2) / 8;
    expect(blob.size).toBeGreaterThan(expected * 0.7);
    expect(blob.size).toBeLessThan(expected * 1.3);
  });

  it("モノラルも書き出せる", async () => {
    const blob = await encodeMp3(fakeBuffer(0.5, 44100, 1), 128);
    expect(blob.size).toBeGreaterThan(500);
  });

  it("進捗が 0 から 1 まで単調に増える", async () => {
    const seen: number[] = [];
    await encodeMp3(fakeBuffer(1.5), 128, (ratio, phase) => {
      expect(phase).toBe("encode");
      seen.push(ratio);
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(1);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });
});

describe("ファイル名の安全化", () => {
  it("使えない文字を落とす", () => {
    expect(safeFilename("C_4chords_96bpm")).toBe("C_4chords_96bpm");
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
    expect(safeFilename("my song")).toBe("my_song");
  });

  it("空文字にはフォールバック名を使う", () => {
    expect(safeFilename("")).toBe("chord-progression");
  });

  it("長すぎる名前を切り詰める", () => {
    expect(safeFilename("a".repeat(200)).length).toBe(80);
  });
});
