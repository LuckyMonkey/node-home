import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, type Token } from './SerpentineSectionList';

const asTopDownGrid = (layout: ReturnType<typeof computeLayout>) => {
  const out: Record<number, number[]> = {};
  for (const col of layout.columnOrder) {
    out[col] = layout.columns[col].rows
      .filter((t): t is Token => Boolean(t))
      .map((t) => {
        if (t.kind !== 'item') return -1;
        return Number(t.itemId.replace('i', ''));
      });
  }
  return out;
};

const itemTokens = (count: number): Token[] =>
  Array.from({ length: count }, (_, i) => ({ kind: 'item', itemId: `i${i + 1}`, sectionId: 's' }));

test('computeLayout default mode matches provided Example A style', () => {
  const layout = computeLayout({
    tokens: itemTokens(20),
    rowsPerColumn: 5,
    containerWidth: 1400,
    columnWidth: 260,
    gap: 12,
    mode: 'promptExamples'
  });

  // Use the 4 center-most columns to match the prompt illustration.
  const grid = asTopDownGrid(layout);
  const cols = layout.columnOrder.slice(0, 4);

  assert.deepEqual(grid[cols[0]], [1, 2, 3, 4, 5]);
  assert.deepEqual(grid[cols[1]], [10, 9, 8, 7, 6]);
  assert.deepEqual(grid[cols[2]], [11, 12, 13, 14, 15]);
  assert.deepEqual(grid[cols[3]], [20, 19, 18, 17, 16]);
});

test('computeLayout alternative mode does leftward bottom-up then rightward top-down', () => {
  const layout = computeLayout({
    tokens: itemTokens(15),
    rowsPerColumn: 5,
    containerWidth: 1100,
    columnWidth: 260,
    gap: 12,
    mode: 'leftwardBottomThenRightTop'
  });

  const grid = asTopDownGrid(layout);
  const colSet = new Set(layout.columnOrder);

  // center column 0 should be filled bottom->top => top-down becomes 5..1
  if (colSet.has(0)) {
    assert.deepEqual(grid[0], [5, 4, 3, 2, 1]);
  }

  // first right column should be filled top->down in this mode.
  const right = layout.columnOrder.find((c) => c > 0);
  if (typeof right === 'number') {
    const vals = grid[right];
    assert.equal(vals[0] < vals[vals.length - 1], true);
  }
});
