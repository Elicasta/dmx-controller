import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Explicit banks keep a large patch inside the available live surface. */
export default function FixtureFaderBank({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(8);
  const [page, setPage] = useState(0);
  const items = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const current = Math.min(page, pages - 1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCapacity(Math.max(1, Math.min(8, Math.floor((element.clientWidth - 20) / 98))));
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="fixture-bank-surface">
    <nav aria-label="Fixture banks">
      <button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
      <output>Bank {current + 1} / {pages}</output>
      <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
    </nav>
    <div className="override-fader-bank" style={{ '--bank-size': capacity } as CSSProperties}>
      {items.slice(current * capacity, (current + 1) * capacity)}
    </div>
  </div>;
}
