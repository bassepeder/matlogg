import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const ACTION_WIDTH = 88;

export function SwipeRow({
  children,
  deleteLabel,
  onDelete,
}: {
  children: ReactNode;
  deleteLabel: string;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; dir?: 'h' | 'v' } | null>(null);
  const moved = useRef(false);
  const open = offset <= -ACTION_WIDTH / 2;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_WIDTH : 0 };
    moved.current = false;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.dir) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        d.dir = 'h';
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      } else if (Math.abs(dy) > 8) {
        drag.current = null;
        return;
      } else return;
    }
    moved.current = true;
    setOffset(Math.max(-ACTION_WIDTH * 1.4, Math.min(0, d.base + dx)));
  }

  function onPointerUp() {
    if (drag.current?.dir === 'h') setOffset((o) => (o < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0));
    drag.current = null;
    setDragging(false);
  }

  return (
    <li className="swipe">
      <button className="swipe-delete" style={{ width: ACTION_WIDTH }} onClick={onDelete} tabIndex={open ? 0 : -1} aria-hidden={!open}>
        {deleteLabel}
      </button>
      <div
        className={`swipe-content${dragging ? ' dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (moved.current || open) {
            e.stopPropagation();
            e.preventDefault();
            if (!moved.current) setOffset(0);
          }
          moved.current = false;
        }}
      >
        {children}
        <button className="sr-only" onClick={onDelete}>
          {deleteLabel}
        </button>
      </div>
    </li>
  );
}
