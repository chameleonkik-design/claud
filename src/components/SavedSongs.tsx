/**
 * 「マイ進行」— 名前を付けて保存した進行の保存と呼び出し。
 *
 * 履歴（元に戻す）はリロードで消えてしまうので、腰を据えて作るときの
 * 保存先としてこちらを使う。保存先は端末内の localStorage。
 */

import { useState } from "react";

import type { SavedSong } from "../state";

interface Props {
  saved: SavedSong[];
  /** 保存名の初期候補。 */
  suggestedName: string;
  /** 今の進行の要約（一覧に出す文言と同じ形式）。 */
  currentSummary: string;
  onSave: (name: string) => void;
  onLoad: (entry: SavedSong) => void;
  onDelete: (entry: SavedSong) => void;
  /** 保存済みの進行をコード名の並びで要約する。 */
  summaryOf: (entry: SavedSong) => string;
}

/** 保存した進行の中身を一行で表す。 */
export function summarize(chordNames: string[]): string {
  const head = chordNames.slice(0, 6).join(" – ");
  return chordNames.length > 6 ? `${head} …（全${chordNames.length}個）` : head;
}

function formatDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SavedSongs({
  saved,
  suggestedName,
  currentSummary,
  onSave,
  onLoad,
  onDelete,
  summaryOf,
}: Props) {
  const [name, setName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const submit = () => {
    onSave(name.trim() || suggestedName);
    setName("");
  };

  const duplicate = saved.some((e) => e.name === (name.trim() || suggestedName));

  return (
    <section className="panel">
      <h2>マイ進行</h2>

      <div className="save-row">
        <input
          type="text"
          className="save-name-input"
          value={name}
          placeholder={suggestedName}
          maxLength={40}
          aria-label="保存する名前"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="btn primary" onClick={submit}>
          {duplicate ? "上書き保存" : "💾 保存"}
        </button>
      </div>

      <p className="hint" style={{ marginTop: 8 }}>
        今の進行：{currentSummary || "（空）"}
        <br />
        名前を空のままにすると「{suggestedName}」で保存します。同じ名前で保存すると上書きされます。
      </p>

      {saved.length === 0 ? (
        <p className="hint">
          まだ保存された進行はありません。気に入った進行ができたら保存しておくと、
          プリセットを試したあとでも呼び戻せます。
        </p>
      ) : (
        <ul className="saved-list">
          {saved.map((entry) => (
            <li key={entry.id} className="saved-item">
              <button
                className="saved-main"
                onClick={() => onLoad(entry)}
                title="この進行を読み込む"
              >
                <span className="saved-name">{entry.name}</span>
                <span className="saved-chords">{summaryOf(entry)}</span>
                <span className="saved-meta">
                  {entry.song.bpm}BPM
                  {entry.savedAt ? ` ・ ${formatDate(entry.savedAt)}` : ""}
                </span>
              </button>

              {confirmingId === entry.id ? (
                <span className="saved-confirm">
                  <button
                    className="btn small"
                    onClick={() => {
                      onDelete(entry);
                      setConfirmingId(null);
                    }}
                    style={{ color: "var(--danger)" }}
                  >
                    削除する
                  </button>
                  <button className="btn small ghost" onClick={() => setConfirmingId(null)}>
                    やめる
                  </button>
                </span>
              ) : (
                <button
                  className="btn icon"
                  onClick={() => setConfirmingId(entry.id)}
                  aria-label={`${entry.name} を削除`}
                  title="削除"
                  style={{ color: "var(--danger)" }}
                >
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
