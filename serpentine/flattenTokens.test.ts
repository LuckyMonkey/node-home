import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenTokens, type Section, type Item } from './SerpentineSectionList';

test('flattenTokens emits section header then section items in order', () => {
  const sections: Section[] = [
    { id: 'critical', title: 'Critical' },
    { id: 'normal', title: 'Normal' }
  ];

  const itemsBySection: Record<string, Item[]> = {
    critical: [
      { id: 'a1', sectionId: 'critical', label: 'A1' },
      { id: 'a2', sectionId: 'critical', label: 'A2' }
    ],
    normal: [{ id: 'b1', sectionId: 'normal', label: 'B1' }]
  };

  const tokens = flattenTokens(sections, itemsBySection);
  assert.deepEqual(tokens, [
    { kind: 'sectionHeader', sectionId: 'critical' },
    { kind: 'item', itemId: 'a1', sectionId: 'critical' },
    { kind: 'item', itemId: 'a2', sectionId: 'critical' },
    { kind: 'sectionHeader', sectionId: 'normal' },
    { kind: 'item', itemId: 'b1', sectionId: 'normal' }
  ]);
});
