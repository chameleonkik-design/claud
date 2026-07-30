/**
 * 進行内の1コードを編集するカード。
 */

import { QUALITIES } from "../music/chords";
import { midiName, pcName, prettyAccidentals } from "../music/notes";
import type { ResolvedChord } from "../music/song";

interface Props {
  chord: ResolvedChord;
  index: number;
  total: number;
  active: boolean;
  useFlats: boolean;
  onChange: (patch: { offset?: number; quality?: string; beats?: number; inversion?: number }) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
}

export function ChordCard({
  chord,
  index,
  total,
  active,
  useFlats,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
  onPreview,
}: Props) {
  const { slot } = chord;
  const noteNames = chord.notes.map((n) => midiName(n, useFlats)).join(" ");

  return (
    <div className={`chord-card${active ? " active" : ""}`}>
      <div className="top">
        <button
          className="name"
          onClick={onPreview}
          title="このコードだけ鳴らす"
          style={{ background: "none", border: "none", padding: 0, textAlign: "left" }}
        >
          {chord.name}
        </button>
        <span className="roman">{prettyAccidentals(chord.roman)}</span>
      </div>

      <div className="notes" title="実際に鳴る音">
        {prettyAccidentals(noteNames)}
      </div>

      <div className="controls">
        <select
          aria-label={`${index + 1}番目のコードのルート`}
          value={slot.offset}
          onChange={(e) => onChange({ offset: Number(e.target.value) })}
          style={{ width: 58 }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {prettyAccidentals(pcName((chord.rootPc - slot.offset + i + 120) % 12, useFlats))}
            </option>
          ))}
        </select>

        <select
          className="quality"
          aria-label={`${index + 1}番目のコードの種類`}
          value={slot.quality}
          onChange={(e) => onChange({ quality: e.target.value })}
        >
          {QUALITIES.map((q) => (
            <option key={q.id} value={q.id} title={q.label}>
              {q.suffix === "" ? "(major)" : prettyAccidentals(q.suffix)}
            </option>
          ))}
        </select>
      </div>

      <div className="controls">
        <input
          className="beats"
          type="number"
          aria-label={`${index + 1}番目のコードの拍数`}
          min={0.5}
          max={32}
          step={0.5}
          value={slot.beats}
          onChange={(e) => onChange({ beats: Number(e.target.value) })}
          title="長さ（拍）"
        />
        <select
          aria-label={`${index + 1}番目のコードの転回`}
          value={slot.inversion ?? 0}
          onChange={(e) => onChange({ inversion: Number(e.target.value) })}
          title="転回形（分数コード）"
          style={{ width: 52 }}
        >
          <option value={0}>自動</option>
          <option value={1}>1転</option>
          <option value={2}>2転</option>
          <option value={3}>3転</option>
        </select>
      </div>

      <div className="controls">
        <button
          className="btn icon"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          title="左へ移動"
          aria-label={`${index + 1}番目のコードを左へ移動`}
        >
          ←
        </button>
        <button
          className="btn icon"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          title="右へ移動"
          aria-label={`${index + 1}番目のコードを右へ移動`}
        >
          →
        </button>
        <button
          className="btn icon"
          onClick={onDuplicate}
          title="複製"
          aria-label={`${index + 1}番目のコードを複製`}
        >
          ⧉
        </button>
        <button
          className="btn icon"
          onClick={onRemove}
          title="削除"
          aria-label={`${index + 1}番目のコードを削除`}
          style={{ marginLeft: "auto", color: "var(--danger)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
