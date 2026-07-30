/**
 * 進行内の1コードを編集するカード。
 */

import { QUALITIES } from "../music/chords";
import { midiName, pcName, prettyAccidentals } from "../music/notes";
import { useFlatsForDegree } from "../music/scales";
import { NumberField } from "./NumberField";
import type { ResolvedChord } from "../music/song";

interface Props {
  chord: ResolvedChord;
  index: number;
  total: number;
  active: boolean;
  useFlats: boolean;
  /** 長押しドラッグで掴まれている最中か。 */
  dragging?: boolean;
  /** 並べ替えのためのハンドラ（長押し検出）。 */
  dragHandlers?: { onPointerDown: (e: React.PointerEvent) => void };
  /** 並べ替えの当たり判定に使うので、DOM を親に渡す。 */
  registerElement?: (el: HTMLDivElement | null) => void;
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
  dragging = false,
  dragHandlers,
  registerElement,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
  onPreview,
}: Props) {
  const { slot } = chord;
  const noteNames = chord.notes.map((n) => midiName(n, useFlats)).join(" ");

  return (
    <div
      ref={registerElement}
      className={`chord-card${active ? " active" : ""}${dragging ? " dragging" : ""}`}
      {...dragHandlers}
    >
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
          {Array.from({ length: 12 }, (_, i) => {
            // rootPc - offset がキーの主音。そこから i 半音上が候補のルート。
            const tonic = (chord.rootPc - slot.offset + 120) % 12;
            return (
              <option key={i} value={i}>
                {prettyAccidentals(pcName(tonic + i, useFlatsForDegree(i, useFlats)))}
              </option>
            );
          })}
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
        <NumberField
          className="beats"
          ariaLabel={`${index + 1}番目のコードの拍数`}
          min={0.5}
          max={32}
          step={0.5}
          value={slot.beats}
          onChange={(beats) => onChange({ beats })}
          title="長さ（拍）"
          steppers
          width={40}
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
          title="このコードを末尾にコピー"
          aria-label={`${index + 1}番目のコードを末尾にコピー`}
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
