import { useEffect, useState } from 'react';

/** Preserve incomplete typing without ever publishing an accidental/clamped tempo. */
export default function TempoInput({ value, onChange, label, disabled = false }: {
  value: number; onChange: (bpm: number) => void; label: string; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (text: string) => {
    const next = Number(text);
    if (/^\d+(\.\d+)?$/.test(text) && next >= 20 && next <= 300) { onChange(next); return true; }
    return false;
  };
  return <input aria-label={label} role="spinbutton" aria-valuemin={20} aria-valuemax={300}
    aria-valuenow={value} type="text" inputMode="decimal" value={draft} disabled={disabled}
    onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
    onBlur={() => { if (!commit(draft)) setDraft(String(value)); }}
    onKeyDown={e => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') { setDraft(String(value)); e.currentTarget.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(20, Math.min(300, Math.round((value + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 1)) * 100) / 100));
        setDraft(String(next)); onChange(next);
      }
    }} />;
}
