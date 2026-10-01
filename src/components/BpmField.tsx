import { useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from 'react';

function clampBpm(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export default function BpmField({
  value,
  onCommit,
  disabled = false,
  min = 20,
  max = 300,
  step = .1,
  ariaLabel = 'BPM',
  className = ''
}: {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const cancelBlur = useRef(false);

  function commit() {
    if (cancelBlur.current) { cancelBlur.current = false; return; }
    const parsed = draft.trim() ? Number(draft) : value;
    const next = clampBpm(Number.isFinite(parsed) ? parsed : value, min, max);
    const rounded = Math.round(next * 10) / 10;
    setDraft(String(rounded));
    if (rounded !== value) onCommit(rounded);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.round(clampBpm(value + (event.key === 'ArrowUp' ? step : -step), min, max) * 10) / 10;
      setDraft(String(next));
      if (next !== value) onCommit(next);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelBlur.current = true;
      setDraft(String(value));
      event.currentTarget.blur();
    }
  }

  function onWheel(event: WheelEvent<HTMLInputElement>) {
    // Number inputs otherwise jump while the user scrolls the page.
    event.currentTarget.blur();
  }

  return <input
    className={className}
    aria-label={ariaLabel}
    type="text"
    inputMode="decimal"
    value={draft}
    disabled={disabled}
    onChange={(event) => {
      const next = event.target.value;
      if (/^\d{0,3}(?:\.\d{0,1})?$/.test(next)) setDraft(next);
    }}
    onBlur={commit}
    onKeyDown={onKeyDown}
    onWheel={onWheel}
    data-min={min}
    data-max={max}
    data-step={step}
  />;
}
