/**
 * キーに合ったコードを並べたパレット。クリックで進行の末尾に追加する。
 */

import { prettyChordName } from "../music/chords";
import { mod12, prettyAccidentals } from "../music/notes";
import {
  borrowedChords,
  diatonicChords,
  getScale,
  useFlatsForDegree,
  type DerivedChord,
} from "../music/scales";
import type { Song } from "../music/song";
import { useLongPress } from "../useLongPress";

interface Props {
  song: Song;
  useFlats: boolean;
  onAdd: (offset: number, quality: string) => void;
  onPreview: (offset: number, quality: string) => void;
}

function Chips({
  chords,
  tonic,
  useFlats,
  borrowed,
  onAdd,
  onPreview,
}: {
  chords: DerivedChord[];
  tonic: number;
  useFlats: boolean;
  borrowed?: boolean;
  onAdd: (offset: number, quality: string) => void;
  onPreview: (offset: number, quality: string) => void;
}) {
  // 「key」は "offset:quality" の形。長押しされたコードを引き当てるのに使う。
  const longPress = useLongPress((key) => {
    const [offset, quality] = key.split(":");
    onPreview(Number(offset), quality);
  });

  return (
    <div className="palette">
      {chords.map((c, i) => (
        <button
          key={`${c.offset}-${c.quality}-${i}`}
          className={`chip${borrowed ? " borrowed" : ""}`}
          {...longPress.handlers(`${c.offset}:${c.quality}`)}
          onClick={() => {
            // 長押しで試聴したときは、続けて飛んでくる click で追加しない
            if (longPress.didLongPress()) return;
            onAdd(c.offset, c.quality);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onPreview(c.offset, c.quality);
          }}
          title="タップで進行に追加 / 長押しで試聴"
        >
          <span>
            {prettyChordName(
              mod12(tonic + c.offset),
              c.quality,
              useFlatsForDegree(c.offset, useFlats),
            )}
          </span>
          <span className="deg">{prettyAccidentals(c.roman)}</span>
        </button>
      ))}
    </div>
  );
}

export function Palette({ song, useFlats, onAdd, onPreview }: Props) {
  const scale = getScale(song.scale);
  const triads = diatonicChords(scale, false);
  const sevenths = diatonicChords(scale, true);
  const borrowed = borrowedChords(scale);

  return (
    <div className="panel">
      <h2>コードパレット</h2>

      <div className="palette-group">
        <h3>ダイアトニック（三和音）</h3>
        <Chips
          chords={triads}
          tonic={song.tonic}
          useFlats={useFlats}
          onAdd={onAdd}
          onPreview={onPreview}
        />
      </div>

      <div className="palette-group">
        <h3>ダイアトニック（七の和音）</h3>
        <Chips
          chords={sevenths}
          tonic={song.tonic}
          useFlats={useFlats}
          onAdd={onAdd}
          onPreview={onPreview}
        />
      </div>

      <div className="palette-group">
        <h3>借用・セカンダリードミナント</h3>
        <Chips
          chords={borrowed}
          tonic={song.tonic}
          useFlats={useFlats}
          borrowed
          onAdd={onAdd}
          onPreview={onPreview}
        />
      </div>

      <p className="hint">
        タップで進行の末尾に追加、長押し（PCでは右クリック）でそのコードだけ試聴します。
      </p>
    </div>
  );
}
