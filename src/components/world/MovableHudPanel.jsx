import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "aetheria_hud_layout_v1";

function readLayouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLayouts(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function clampLayout(layout, minWidth, minHeight) {
  if (typeof window === "undefined") return layout;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(minWidth, Number(layout.width || minWidth));
  const height = Math.max(minHeight, Number(layout.height || minHeight));
  const x = clamp(Number(layout.x || 0), 0, Math.max(0, vw - width));
  const y = clamp(Number(layout.y || 0), 0, Math.max(0, vh - height));
  return { ...layout, x, y, width, height };
}

export default function MovableHudPanel({
  panelId,
  title,
  defaultLayout,
  minWidth = 180,
  minHeight = 80,
  zIndex = 40,
  renderContextControls = null,
  children,
}) {
  const mergedDefault = useMemo(
    () => ({
      x: 20,
      y: 20,
      width: 280,
      height: 180,
      opacity: 0.95,
      locked: false,
      ...(defaultLayout || {}),
    }),
    [defaultLayout]
  );

  const [layout, setLayout] = useState(() => {
    const saved = readLayouts()[panelId] || {};
    const next = { ...mergedDefault, ...saved };
    return clampLayout(next, minWidth, minHeight);
  });
  const [menu, setMenu] = useState(null);
  const panelRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const all = readLayouts();
    all[panelId] = layout;
    writeLayouts(all);
  }, [layout, panelId]);

  useEffect(() => {
    const onResize = () => {
      setLayout((prev) => clampLayout(prev, minWidth, minHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minHeight, minWidth]);

  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setLayout((prev) => {
        const width = Math.max(minWidth, Math.round(rect.width));
        const height = Math.max(minHeight, Math.round(rect.height));
        if (Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2) return prev;
        return clampLayout({ ...prev, width, height }, minWidth, minHeight);
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [minHeight, minWidth]);

  const onDragStart = useCallback((e) => {
    if (layout.locked) return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      offsetX: e.clientX - layout.x,
      offsetY: e.clientY - layout.y,
    };
  }, [layout.locked, layout.x, layout.y]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const nx = e.clientX - dragRef.current.offsetX;
      const ny = e.clientY - dragRef.current.offsetY;
      setLayout((prev) => clampLayout({ ...prev, x: nx, y: ny }, minWidth, minHeight));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minHeight, minWidth]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const content = typeof children === "function" ? children({ layout, setLayout }) : children;

  return (
    <>
      <div
        ref={panelRef}
        className="absolute pointer-events-auto border border-[#544b38] rounded-md bg-black/85 shadow-2xl overflow-hidden"
        style={{
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          opacity: layout.opacity,
          zIndex,
          resize: layout.locked ? "none" : "both",
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div
          className={`h-6 px-2 border-b border-[#3f3a2d] bg-[#131216]/95 text-[11px] text-[#d3c39a] flex items-center justify-between ${layout.locked ? "cursor-default" : "cursor-move"}`}
          onMouseDown={onDragStart}
        >
          <span className="truncate pr-2">{title}</span>
          <span className="text-[10px] opacity-70">{layout.locked ? "Locked" : "Unlocked"}</span>
        </div>
        <div className="w-full" style={{ height: "calc(100% - 24px)" }}>
          {content}
        </div>
      </div>

      {menu && (
        <div
          className="fixed z-[120] w-64 rounded-md border border-[#5a503b] bg-[#111015]/98 p-2 text-[11px] text-[#ddd4bf] shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="w-full rounded border border-[#524735] bg-[#1b1821] px-2 py-1 text-left hover:bg-[#24202d]"
            onClick={() => setLayout((prev) => ({ ...prev, locked: !prev.locked }))}
          >
            {layout.locked ? "Unlock panel" : "Lock panel"}
          </button>

          <label className="mt-2 block text-[10px] uppercase tracking-wide text-[#ad9f7a]">Opacity</label>
          <input
            type="range"
            min={25}
            max={100}
            value={Math.round((layout.opacity || 1) * 100)}
            onChange={(e) => {
              const val = Number(e.target.value || 95) / 100;
              setLayout((prev) => ({ ...prev, opacity: clamp(val, 0.25, 1) }));
            }}
            className="mt-1 w-full"
          />

          <div className="mt-1 text-[10px] text-[#8f866f]">
            Unlock to drag and resize using the panel corner.
          </div>

          {renderContextControls && (
            <div className="mt-2 border-t border-[#34303a] pt-2">
              {renderContextControls({ layout, setLayout })}
            </div>
          )}

          <button
            type="button"
            className="mt-2 w-full rounded border border-[#6b5a3e] bg-[#2a2418] px-2 py-1 text-left text-[#f0dda8] hover:bg-[#352c1d]"
            onClick={() => setLayout(clampLayout({ ...mergedDefault }, minWidth, minHeight))}
          >
            Reset panel
          </button>
        </div>
      )}
    </>
  );
}
