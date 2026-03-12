import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

export type Item = { id: string; sectionId: string; label: string };
export type Section = { id: string; title: string; description?: string };

export type Token =
  | { kind: 'sectionHeader'; sectionId: string }
  | { kind: 'item'; itemId: string; sectionId: string };

export type MappingMode = 'promptExamples' | 'leftwardBottomThenRightTop';

export function flattenTokens(sections: Section[], itemsBySection: Record<string, Item[]>): Token[] {
  const out: Token[] = [];
  for (const section of sections) {
    out.push({ kind: 'sectionHeader', sectionId: section.id });
    const items = Array.isArray(itemsBySection[section.id]) ? itemsBySection[section.id] : [];
    for (const item of items) {
      out.push({ kind: 'item', itemId: item.id, sectionId: section.id });
    }
  }
  return out;
}

export type LayoutInput = {
  tokens: Token[];
  rowsPerColumn: number;
  containerWidth: number;
  columnWidth?: number;
  gap?: number;
  mode?: MappingMode;
};

export type LayoutOutput = {
  columns: Record<number, { rows: (Token | null)[] }>;
  columnOrder: number[];
};

function getColumnFlowDir(colPos: number, mode: MappingMode): 1 | -1 {
  // Rendered-column parity pattern:
  // col 0: down (top->bottom), col 1: up (bottom->top), col 2: down, ...
  // +1 => bottom-up column flow (enter from below), -1 => top-down (enter from above).
  void mode;
  return colPos % 2 === 0 ? -1 : 1;
}

function tokenStableId(token: Token | undefined): string | null {
  if (!token) return null;
  return token.kind === 'sectionHeader' ? `h:${token.sectionId}` : `i:${token.itemId}`;
}

export function computeColumnOrder(containerWidth: number, columnWidth = 260, gap = 12): number[] {
  const usable = Math.max(containerWidth, columnWidth);
  const totalCols = Math.max(1, Math.floor((usable + gap) / (columnWidth + gap)));
  const left = Math.floor((totalCols - 1) / 2);
  const right = totalCols - 1 - left;
  const order: number[] = [];
  for (let i = -left; i <= right; i += 1) order.push(i);
  return order;
}

function fillPromptExampleStyle(tokens: Token[], rowsPerColumn: number, columnOrder: number[]): LayoutOutput {
  const columns: Record<number, { rows: (Token | null)[] }> = {};
  for (const c of columnOrder) columns[c] = { rows: Array.from({ length: rowsPerColumn }, () => null) };

  let idx = 0;
  for (let colPos = 0; colPos < columnOrder.length && idx < tokens.length; colPos += 1) {
    const col = columnOrder[colPos];
    const topDown = colPos % 2 === 0;
    if (topDown) {
      for (let r = 0; r < rowsPerColumn && idx < tokens.length; r += 1) columns[col].rows[r] = tokens[idx++];
    } else {
      for (let r = rowsPerColumn - 1; r >= 0 && idx < tokens.length; r -= 1) columns[col].rows[r] = tokens[idx++];
    }
  }

  // Continue sweeping in the same serpentine pattern for overflow.
  while (idx < tokens.length) {
    for (let colPos = 0; colPos < columnOrder.length && idx < tokens.length; colPos += 1) {
      const col = columnOrder[colPos];
      const topDown = colPos % 2 === 0;
      if (topDown) {
        for (let r = 0; r < rowsPerColumn && idx < tokens.length; r += 1) columns[col].rows[r] = tokens[idx++];
      } else {
        for (let r = rowsPerColumn - 1; r >= 0 && idx < tokens.length; r -= 1) columns[col].rows[r] = tokens[idx++];
      }
    }
  }

  return { columns, columnOrder };
}

function fillLeftwardThenRight(tokens: Token[], rowsPerColumn: number, columnOrder: number[]): LayoutOutput {
  const columns: Record<number, { rows: (Token | null)[] }> = {};
  for (const c of columnOrder) columns[c] = { rows: Array.from({ length: rowsPerColumn }, () => null) };

  const leftCols = columnOrder.filter((c) => c <= 0).sort((a, b) => b - a); // 0, -1, -2...
  const rightCols = columnOrder.filter((c) => c > 0).sort((a, b) => a - b); // 1, 2...
  const visitCols = [...leftCols, ...rightCols];

  let idx = 0;
  while (idx < tokens.length) {
    for (const col of visitCols) {
      if (idx >= tokens.length) break;
      const isLeftPhase = col <= 0;
      if (isLeftPhase) {
        for (let r = rowsPerColumn - 1; r >= 0 && idx < tokens.length; r -= 1) columns[col].rows[r] = tokens[idx++];
      } else {
        for (let r = 0; r < rowsPerColumn && idx < tokens.length; r += 1) columns[col].rows[r] = tokens[idx++];
      }
    }
  }

  return { columns, columnOrder };
}

export function computeLayout(input: LayoutInput): LayoutOutput {
  const {
    tokens,
    rowsPerColumn,
    containerWidth,
    columnWidth = 260,
    gap = 12,
    mode = 'promptExamples'
  } = input;

  const safeRows = Math.max(1, Math.floor(rowsPerColumn));
  const columnOrder = computeColumnOrder(containerWidth, columnWidth, gap);

  if (mode === 'leftwardBottomThenRightTop') {
    return fillLeftwardThenRight(tokens, safeRows, columnOrder);
  }
  return fillPromptExampleStyle(tokens, safeRows, columnOrder);
}

export type SerpentineSectionListProps = {
  title: string;
  description: string;
  sections: Section[];
  itemsBySection: Record<string, Item[]>;
  rowHeight?: number;
  columnWidth?: number;
  gap?: number;
  mode?: MappingMode;
  onItemsReorder?: (sectionId: string, nextItems: Item[]) => void;
};

export default function SerpentineSectionList(props: SerpentineSectionListProps) {
  const {
    title,
    description,
    sections,
    itemsBySection,
    rowHeight = 56,
    columnWidth = 260,
    gap = 12,
    mode = 'promptExamples',
    onItemsReorder
  } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(960);
  const [rowsPerColumn, setRowsPerColumn] = useState(8);
  const [slitherStep, setSlitherStep] = useState(0);
  const prevTokenRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const pendingWheelDirRef = useRef<1 | -1>(1);

  useLayoutEffect(() => {
    const update = () => {
      const root = rootRef.current;
      const header = headerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const style = getComputedStyle(root);
      const padY = parseFloat(style.paddingTop || '0') + parseFloat(style.paddingBottom || '0');
      const availableHeight = Math.max(0, rootRect.height - headerH - padY);
      const rows = Math.max(1, Math.floor(availableHeight / rowHeight));
      setContainerW(Math.max(rootRect.width, columnWidth));
      setRowsPerColumn(rows);
    };

    update();
    const ro = new ResizeObserver(update);
    if (rootRef.current) ro.observe(rootRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [columnWidth, rowHeight]);

  const tokens = useMemo(() => flattenTokens(sections, itemsBySection), [sections, itemsBySection]);
  const slitheredTokens = useMemo(() => {
    if (!tokens.length) return tokens;
    if (tokens.length === 1) return tokens;
    let pinnedEnd = 1;
    for (let i = 1; i < tokens.length; i += 1) {
      if (tokens[i].kind === 'sectionHeader') break;
      pinnedEnd = i + 1;
    }
    const pinned = tokens.slice(0, pinnedEnd);
    const rest = tokens.slice(pinnedEnd);
    if (!rest.length) return pinned;
    const k = ((slitherStep % rest.length) + rest.length) % rest.length;
    if (k === 0) return [...pinned, ...rest];
    return [...pinned, ...rest.slice(k), ...rest.slice(0, k)];
  }, [tokens, slitherStep]);
  const layout = useMemo(
    () => computeLayout({ tokens: slitheredTokens, rowsPerColumn, containerWidth: containerW, columnWidth, gap, mode }),
    [slitheredTokens, rowsPerColumn, containerW, columnWidth, gap, mode]
  );
  const edgeTokenIds = useMemo(() => {
    const firstId = tokenStableId(slitheredTokens[0]);
    const lastId = tokenStableId(slitheredTokens[slitheredTokens.length - 1]);
    return new Set([firstId, lastId].filter((v): v is string => Boolean(v)));
  }, [slitheredTokens]);

  useLayoutEffect(() => {
    if (slitherStep === 0) return;
    const root = rootRef.current;
    if (!root) return;
    const prev = prevTokenRectsRef.current;
    if (!prev.size) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-s-token-id]'));
    const scrollDir = pendingWheelDirRef.current;
    const overshoot = scrollDir > 0 ? -10 : 10;

    nodes.forEach((node) => {
      const id = node.dataset.sTokenId || '';
      if (!id) return;
      const before = prev.get(id);
      if (!before) return;
      const after = node.getBoundingClientRect();
      let fromX = before.left - after.left;
      let fromY = before.top - after.top;
      const lockToToast = edgeTokenIds.has(id);

      const crossedColumn = Math.abs(before.left - after.left) > 10;
      const wrappedWithinColumn = !crossedColumn && Math.abs(fromY) > after.height * 1.6;
      if (crossedColumn || wrappedWithinColumn) {
        const colPos = Number(node.dataset.sColPos || '0');
        const columnFlowDir = getColumnFlowDir(colPos, mode);
        // Toast-like enter from the column flow edge.
        const enterSign = columnFlowDir;
        fromY = (after.height + 22) * enterSign;
      }
      if (lockToToast) {
        const colPos = Number(node.dataset.sColPos || '0');
        const columnFlowDir = getColumnFlowDir(colPos, mode);
        fromX = 0;
        fromY = (after.height + 22) * columnFlowDir;
      }
      if (Math.abs(fromY) < 1 && Math.abs(fromX) < 1) return;

      if (crossedColumn && !lockToToast) {
        node.animate(
          [
            { transform: `translate(${fromX}px, ${fromY}px)` },
            { transform: 'translate(0, 0)' }
          ],
          { duration: 520, easing: 'cubic-bezier(0.22, 0.78, 0.2, 1)' }
        );
      } else {
        node.animate(
          [
            { transform: `translate(${fromX}px, ${fromY}px)` },
            { transform: `translate(0, ${overshoot}px)`, offset: 0.84 },
            { transform: 'translate(0, 0)', offset: 1 }
          ],
          {
            duration: 560,
            easing: 'cubic-bezier(0.2, 0.9, 0.15, 1)'
          }
        );
      }
    });
    prevTokenRectsRef.current = new Map();
  }, [edgeTokenIds, mode, slitherStep]);

  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const itemById = useMemo(() => {
    const m = new Map<string, Item>();
    Object.values(itemsBySection).forEach((items) => items.forEach((it) => m.set(it.id, it)));
    return m;
  }, [itemsBySection]);

  const onDragStart = (ev: React.DragEvent, token: Token) => {
    if (token.kind !== 'item') return;
    ev.dataTransfer.setData('text/plain', JSON.stringify(token));
    ev.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (ev: React.DragEvent, target: Token | null) => {
    const raw = ev.dataTransfer.getData('text/plain');
    if (!raw || !target || target.kind !== 'item') {
      ev.dataTransfer.dropEffect = 'none';
      return;
    }
    try {
      const source = JSON.parse(raw) as Token;
      if (source.kind !== 'item' || source.sectionId !== target.sectionId) {
        ev.dataTransfer.dropEffect = 'none';
        return;
      }
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
    } catch {
      ev.dataTransfer.dropEffect = 'none';
    }
  };

  const onDrop = (ev: React.DragEvent, target: Token | null) => {
    const raw = ev.dataTransfer.getData('text/plain');
    if (!raw || !target || target.kind !== 'item') return;
    try {
      const source = JSON.parse(raw) as Token;
      if (source.kind !== 'item' || source.sectionId !== target.sectionId) return;
      const sectionId = source.sectionId;
      const list = (itemsBySection[sectionId] || []).slice();
      const from = list.findIndex((x) => x.id === source.itemId);
      const to = list.findIndex((x) => x.id === target.itemId);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      onItemsReorder?.(sectionId, list);
      ev.preventDefault();
    } catch {
      // noop
    }
  };

  const onItemKeyDown = (ev: React.KeyboardEvent, token: Token) => {
    if (token.kind !== 'item') return;
    if (!(ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown'))) return;
    const list = (itemsBySection[token.sectionId] || []).slice();
    const i = list.findIndex((x) => x.id === token.itemId);
    if (i < 0) return;
    const delta = ev.key === 'ArrowUp' ? -1 : 1;
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    onItemsReorder?.(token.sectionId, list);
    ev.preventDefault();
  };

  const itemDecor = (id: string) => {
    const emojis = ['🍎', '🚀', '🎯', '🌿', '🧠', '🛰️', '🎵', '🧩', '🧪', '📦', '🛠️', '⚡', '🌈', '🧭', '🔥', '🌊'];
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    const emoji = emojis[hash % emojis.length];
    return {
      emoji,
      bg: `hsl(${hue} 72% 96%)`,
      border: `hsl(${hue} 44% 70%)`,
      dot: `hsl(${hue} 68% 46%)`
    };
  };

  const lastWheelAt = useRef(0);
  useLayoutEffect(() => {
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) return;
      const now = Date.now();
      if (now - lastWheelAt.current < 45) return;
      lastWheelAt.current = now;
      const d = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
      if (Math.abs(d) < 0.5) return;
      ev.preventDefault();
      const root = rootRef.current;
      if (root) {
        const nextRects = new Map<string, DOMRect>();
        const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-s-token-id]'));
        nodes.forEach((node) => {
          const id = node.dataset.sTokenId || '';
          if (!id) return;
          nextRects.set(id, node.getBoundingClientRect());
        });
        prevTokenRectsRef.current = nextRects;
      }
      pendingWheelDirRef.current = d > 0 ? 1 : -1;
      setSlitherStep((prev) => prev + pendingWheelDirRef.current);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as EventListener);
  }, []);

  return (
    <div ref={rootRef} style={{ height: '100%', padding: 12, boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12 }}>
      <div ref={headerRef} style={{ border: '1px solid #d0d4dc', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <p style={{ margin: '4px 0 0', color: '#5b6470', fontSize: 13 }}>{description}</p>
      </div>

      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap, justifyContent: 'center', alignItems: 'flex-start' }}>
          {layout.columnOrder.map((colIdx) => {
            const col = layout.columns[colIdx];
            const colPos = layout.columnOrder.indexOf(colIdx);
            return (
              <div key={colIdx} style={{ width: columnWidth, minWidth: columnWidth, display: 'grid', gap: 12 }}>
                {col.rows.map((token, rowIdx) => {
                  if (!token) {
                    return <div key={`empty-${rowIdx}`} style={{ height: rowHeight, borderRadius: 6, background: 'transparent' }} />;
                  }
                  if (token.kind === 'sectionHeader') {
                    const section = sectionById.get(token.sectionId);
                    return (
                      <div
                        key={`h-${token.sectionId}`}
                        data-s-token-id={`h:${token.sectionId}`}
                        data-s-col-pos={String(colPos)}
                        style={{
                          height: rowHeight,
                          borderRadius: 8,
                          border: '2px solid #6f7f97',
                          background: 'linear-gradient(135deg, #e7eef8, #dbe7f6)',
                          padding: '6px 8px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 0 rgba(0,0,0,0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: '#30425c', border: '1px solid #8ea1bf', borderRadius: 999, padding: '1px 6px', background: '#f4f8ff' }}>
                            LEADER
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>{section?.title || token.sectionId}</span>
                        </div>
                        {section?.description ? <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{section.description}</div> : null}
                      </div>
                    );
                  }

                  const item = itemById.get(token.itemId);
                  const decor = itemDecor(token.itemId);
                  return (
                    <div
                      key={`i-${token.itemId}`}
                      data-s-token-id={`i:${token.itemId}`}
                      data-s-col-pos={String(colPos)}
                      role="button"
                      tabIndex={0}
                      draggable
                      onKeyDown={(ev) => onItemKeyDown(ev, token)}
                      onDragStart={(ev) => onDragStart(ev, token)}
                      onDragOver={(ev) => onDragOver(ev, token)}
                      onDrop={(ev) => onDrop(ev, token)}
                      style={{
                        height: rowHeight,
                        borderRadius: 6,
                        border: `1px solid ${decor.border}`,
                        background: decor.bg,
                        padding: '0 10px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'grab',
                        userSelect: 'none'
                      }}
                      title="Alt+ArrowUp/ArrowDown to reorder in section"
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: decor.dot,
                          marginRight: 8,
                          flex: '0 0 auto'
                        }}
                      />
                      <span aria-hidden="true" style={{ marginRight: 8 }}>{decor.emoji}</span>
                      <span>{item?.label || token.itemId}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
