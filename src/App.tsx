import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BITRATES,
  downloadBlob,
  encodeMp3,
  encodeWav,
  renderSong,
  safeFilename,
  type Bitrate,
} from "./audio/export";
import { INSTRUMENTS } from "./audio/instruments";
import { Player } from "./audio/player";
import { ChordCard } from "./components/ChordCard";
import { Keyboard } from "./components/Keyboard";
import { Palette } from "./components/Palette";
import { pcName, prettyAccidentals } from "./music/notes";
import { BASS_PATTERNS, CHORD_PATTERNS, DRUM_PATTERNS } from "./music/patterns";
import { PRESETS, presetToSlots } from "./music/presets";
import { SCALES } from "./music/scales";
import {
  buildArrangement,
  makeSlot,
  resolveChords,
  totalBars,
  useFlatsForSong,
  type ChordSlot,
  type Song,
} from "./music/song";
import { loadSong, saveSong, shareUrl } from "./state";

type ExportState =
  | { kind: "idle" }
  | { kind: "working"; ratio: number; phase: "render" | "encode"; format: string }
  | { kind: "error"; message: string };

export default function App() {
  const [song, setSong] = useState<Song>(() => loadSong());
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [activeChord, setActiveChord] = useState<number | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" });
  const [bitrate, setBitrate] = useState<Bitrate>(192);
  const [copied, setCopied] = useState(false);

  const playerRef = useRef<Player | null>(null);
  /** 最後に再生を開始した設定。設定変更で組み直すべきかの判定に使う。 */
  const lastPlayedRef = useRef<{ song: Song; loop: boolean } | null>(null);
  const player = (): Player => {
    if (!playerRef.current) {
      const p = new Player();
      p.onEnded = () => {
        setPlaying(false);
        setActiveChord(null);
      };
      playerRef.current = p;
    }
    return playerRef.current;
  };

  const useFlats = useFlatsForSong(song);
  const resolved = useMemo(() => resolveChords(song), [song]);
  const arrangement = useMemo(() => buildArrangement(song), [song]);

  // 保存（少し待ってから書くことで、スライダー操作中の連続書き込みを避ける）
  useEffect(() => {
    const t = window.setTimeout(() => saveSong(song), 400);
    return () => window.clearTimeout(t);
  }, [song]);

  // 再生位置に応じてコードをハイライト
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const pos = playerRef.current?.position();
      setActiveChord(pos ? pos.chordIndex : null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // 画面を離れるときは音を止める
  useEffect(() => () => playerRef.current?.stop(), []);

  const update = useCallback((patch: Partial<Song>) => {
    setSong((s) => ({ ...s, ...patch }));
  }, []);

  const updateChords = useCallback((fn: (chords: ChordSlot[]) => ChordSlot[]) => {
    setSong((s) => ({ ...s, chords: fn(s.chords) }));
  }, []);

  const handlePlay = async () => {
    const p = player();
    if (playing) {
      p.stop();
      setPlaying(false);
      setActiveChord(null);
      return;
    }
    if (song.chords.length === 0) return;
    setPlaying(true);
    lastPlayedRef.current = { song, loop };
    try {
      await p.play(song, loop);
    } catch (err) {
      setPlaying(false);
      setExportState({
        kind: "error",
        message: `再生を開始できませんでした: ${describeError(err)}`,
      });
    }
  };

  // 再生中に設定を変えたら、その場で組み直して変更を聴けるようにする。
  // 再生開始直後の二重再生を避けるため、最後に再生した設定と一致していたら何もしない。
  useEffect(() => {
    if (!playing) return;
    const p = playerRef.current;
    if (!p) return;
    const last = lastPlayedRef.current;
    if (last && last.song === song && last.loop === loop) return;
    const t = window.setTimeout(() => {
      lastPlayedRef.current = { song, loop };
      void p.play(song, loop);
    }, 220);
    return () => window.clearTimeout(t);
  }, [song, loop, playing]);

  const previewChord = (offset: number, quality: string) => {
    const slot = makeSlot(offset, quality);
    const probe = resolveChords({ ...song, chords: [slot] });
    void player().preview(song, probe[0].notes);
  };

  const doExport = async (format: "mp3" | "wav") => {
    if (song.chords.length === 0) return;
    playerRef.current?.stop();
    setPlaying(false);
    setExportState({ kind: "working", ratio: 0, phase: "render", format: format.toUpperCase() });
    try {
      const buffer = await renderSong(song, (ratio, phase) =>
        setExportState({ kind: "working", ratio, phase, format: format.toUpperCase() }),
      );
      const name = safeFilename(
        `${pcName(song.tonic, useFlats)}_${song.chords.length}chords_${song.bpm}bpm`,
      );
      if (format === "wav") {
        downloadBlob(encodeWav(buffer), `${name}.wav`);
      } else {
        const blob = await encodeMp3(buffer, bitrate, (ratio, phase) =>
          setExportState({ kind: "working", ratio, phase, format: "MP3" }),
        );
        downloadBlob(blob, `${name}.mp3`);
      }
      setExportState({ kind: "idle" });
    } catch (err) {
      setExportState({
        kind: "error",
        message: `書き出しに失敗しました: ${describeError(err)}`,
      });
    }
  };

  const copyShareUrl = async () => {
    const url = shareUrl(song);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // クリップボードが使えない環境ではハッシュだけ書き換えて、URL欄からコピーしてもらう
      location.hash = new URL(url).hash;
    }
  };

  const bars = totalBars(song);
  const seconds = arrangement.durationSeconds;
  const highlightNotes =
    activeChord !== null && resolved[activeChord]
      ? [...resolved[activeChord].notes, resolved[activeChord].bass]
      : resolved[0]
        ? [...resolved[0].notes, resolved[0].bass]
        : [];
  const highlightRoot =
    activeChord !== null && resolved[activeChord]
      ? resolved[activeChord].rootPc
      : resolved[0]?.rootPc;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🎹 Chord Progression Studio</h1>
          <p className="sub">
            コード進行を組んで、その場で試聴して、MP3でダウンロード。すべてブラウザ内で完結します。
          </p>
        </div>
      </header>

      {/* --- 再生・書き出し --- */}
      <section className="panel">
        <div className="transport">
          <button className="btn primary" onClick={handlePlay} disabled={song.chords.length === 0}>
            {playing ? "■ 停止" : "▶ 試聴"}
          </button>

          <label className="checkline">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            ループ
          </label>

          <span className="spacer" />

          <div className="field">
            <label htmlFor="bitrate">ビットレート</label>
            <select
              id="bitrate"
              value={bitrate}
              onChange={(e) => setBitrate(Number(e.target.value) as Bitrate)}
            >
              {BITRATES.map((b) => (
                <option key={b} value={b}>
                  {b} kbps
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn accent"
            onClick={() => void doExport("mp3")}
            disabled={exportState.kind === "working" || song.chords.length === 0}
          >
            ⬇ MP3をダウンロード
          </button>
          <button
            className="btn"
            onClick={() => void doExport("wav")}
            disabled={exportState.kind === "working" || song.chords.length === 0}
          >
            WAV
          </button>
          <button className="btn ghost" onClick={() => void copyShareUrl()}>
            {copied ? "✓ コピーしました" : "🔗 共有リンク"}
          </button>
        </div>

        <div className="status" style={{ marginTop: 10 }}>
          {bars % 1 === 0 ? bars : bars.toFixed(2)} 小節 / {song.repeats} 回くり返し ={" "}
          {formatDuration(seconds)}
          {exportState.kind === "working" && (
            <>
              {" — "}
              {exportState.format}{" "}
              {exportState.phase === "render" ? "レンダリング中" : "エンコード中"}{" "}
              {Math.round(exportState.ratio * 100)}%
            </>
          )}
        </div>

        {exportState.kind === "working" && (
          <div className="progress">
            <div
              style={{
                width: `${Math.round(
                  (exportState.phase === "render" ? 0.15 : 0.15 + exportState.ratio * 0.85) * 100,
                )}%`,
              }}
            />
          </div>
        )}

        {exportState.kind === "error" && <p className="error">{exportState.message}</p>}
      </section>

      {/* --- 曲の設定 --- */}
      <section className="panel">
        <h2>曲の設定</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="tonic">キー</label>
            <select
              id="tonic"
              value={song.tonic}
              onChange={(e) => update({ tonic: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {prettyAccidentals(pcName(i, useFlats))}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="scale">スケール</label>
            <select
              id="scale"
              value={song.scale}
              onChange={(e) => update({ scale: e.target.value })}
            >
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="bpm">テンポ（BPM）</label>
            <input
              id="bpm"
              type="number"
              min={30}
              max={300}
              value={song.bpm}
              onChange={(e) => update({ bpm: Number(e.target.value) || 96 })}
            />
          </div>

          <div className="field">
            <label htmlFor="bpb">拍子（1小節の拍数）</label>
            <select
              id="bpb"
              value={song.beatsPerBar}
              onChange={(e) => update({ beatsPerBar: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 7].map((b) => (
                <option key={b} value={b}>
                  {b}/4
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="repeats">くり返し回数</label>
            <input
              id="repeats"
              type="number"
              min={1}
              max={16}
              value={song.repeats}
              onChange={(e) => update({ repeats: Number(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="instrument">音色</label>
            <select
              id="instrument"
              value={song.instrument}
              onChange={(e) => update({ instrument: e.target.value })}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="chordPattern">弾き方</label>
            <select
              id="chordPattern"
              value={song.chordPattern}
              onChange={(e) => update({ chordPattern: e.target.value })}
            >
              {CHORD_PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="bassPattern">ベース</label>
            <select
              id="bassPattern"
              value={song.bassPattern}
              onChange={(e) => update({ bassPattern: e.target.value })}
              disabled={!song.bassEnabled}
            >
              {BASS_PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="drumPattern">ドラム</label>
            <select
              id="drumPattern"
              value={song.drumPattern}
              onChange={(e) => update({ drumPattern: e.target.value })}
            >
              {DRUM_PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="reverb">リバーブ {Math.round(song.reverb * 100)}%</label>
            <input
              id="reverb"
              type="range"
              min={0}
              max={100}
              value={Math.round(song.reverb * 100)}
              onChange={(e) => update({ reverb: Number(e.target.value) / 100 })}
            />
          </div>

          <div className="field">
            <label htmlFor="volume">音量 {Math.round(song.volume * 100)}%</label>
            <input
              id="volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(song.volume * 100)}
              onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <label className="checkline">
            <input
              type="checkbox"
              checked={song.bassEnabled}
              onChange={(e) => update({ bassEnabled: e.target.checked })}
            />
            ベースを鳴らす
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={song.smoothVoicing}
              onChange={(e) => update({ smoothVoicing: e.target.checked })}
            />
            なめらかなボイシング（転回を自動選択）
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={song.tail}
              onChange={(e) => update({ tail: e.target.checked })}
            />
            書き出しに余韻を残す
          </label>
        </div>
      </section>

      {/* --- 進行 --- */}
      <section className="panel">
        <h2>コード進行</h2>
        <div className="timeline">
          {resolved.map((c, i) => (
            <ChordCard
              key={c.slot.id}
              chord={c}
              index={i}
              total={resolved.length}
              active={playing && activeChord === i}
              useFlats={useFlats}
              onPreview={() => void player().preview(song, c.notes)}
              onChange={(patch) =>
                updateChords((chords) =>
                  chords.map((s) =>
                    s.id === c.slot.id
                      ? {
                          ...s,
                          ...patch,
                          ...(patch.inversion !== undefined
                            ? { inversion: patch.inversion || undefined }
                            : {}),
                        }
                      : s,
                  ),
                )
              }
              onMove={(delta) =>
                updateChords((chords) => {
                  const from = chords.findIndex((s) => s.id === c.slot.id);
                  const to = from + delta;
                  if (from < 0 || to < 0 || to >= chords.length) return chords;
                  const next = [...chords];
                  [next[from], next[to]] = [next[to], next[from]];
                  return next;
                })
              }
              onDuplicate={() =>
                updateChords((chords) => {
                  const at = chords.findIndex((s) => s.id === c.slot.id);
                  if (at < 0) return chords;
                  const copy = makeSlot(c.slot.offset, c.slot.quality, c.slot.beats);
                  if (c.slot.inversion) copy.inversion = c.slot.inversion;
                  return [...chords.slice(0, at + 1), copy, ...chords.slice(at + 1)];
                })
              }
              onRemove={() => updateChords((chords) => chords.filter((s) => s.id !== c.slot.id))}
            />
          ))}

          <button
            className="add-card"
            onClick={() =>
              updateChords((chords) => [
                ...chords,
                makeSlot(0, "maj", chords.at(-1)?.beats ?? song.beatsPerBar),
              ])
            }
          >
            ＋ コードを追加
          </button>
        </div>

        {song.chords.length > 0 && (
          <>
            <div style={{ marginTop: 16 }}>
              <Keyboard highlight={highlightNotes} rootPc={highlightRoot} />
            </div>
            <p className="hint">
              コード名をクリックするとその和音だけ鳴ります。「拍数」で長さ、「転回」で分数コードにできます。
            </p>
          </>
        )}

        {song.chords.length === 0 && (
          <p className="hint">
            進行が空です。下のプリセットかコードパレットから追加してください。
          </p>
        )}
      </section>

      {/* --- プリセット --- */}
      <section className="panel">
        <h2>定番進行プリセット</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              onClick={() =>
                setSong((s) => ({
                  ...s,
                  scale: p.scale,
                  chords: presetToSlots(p, s.beatsPerBar),
                }))
              }
            >
              <div className="pname">{p.name}</div>
              <div className="phint">{p.hint}</div>
            </button>
          ))}
        </div>
        <p className="hint">
          プリセットはキーに依存しません。読み込んだあとにキーを変えれば、そのまま移調されます。
        </p>
      </section>

      {/* --- パレット --- */}
      <Palette
        song={song}
        useFlats={useFlats}
        onAdd={(offset, quality) =>
          updateChords((chords) => [
            ...chords,
            makeSlot(offset, quality, chords.at(-1)?.beats ?? song.beatsPerBar),
          ])
        }
        onPreview={previewChord}
      />

      <footer className="footer">
        音源はブラウザの Web Audio API で合成しています。MP3 のエンコードも端末内で行われ、
        音声データがどこかへ送信されることはありません。
      </footer>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}分${s.toFixed(1)}秒` : `${s.toFixed(1)}秒`;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
