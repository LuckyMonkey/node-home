import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SerpentineSectionList, { type Item, type Section } from './SerpentineSectionList';

const sections: Section[] = [
  { id: 'critical', title: 'Critical', description: 'Must-do now' },
  { id: 'normal', title: 'Normal', description: 'Routine queue' },
  { id: 'someday', title: 'Someday', description: 'Backlog / ideas' }
];

const makeItems = (sectionId: string, count: number, prefix: string): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${sectionId}-${i + 1}`,
    sectionId,
    label: `${prefix} ${i + 1}`
  }));

function DemoApp() {
  const [itemsBySection, setItemsBySection] = useState<Record<string, Item[]>>({
    critical: makeItems('critical', 19, 'Critical'),
    normal: makeItems('normal', 21, 'Normal'),
    someday: makeItems('someday', 17, 'Someday')
  });

  const total = useMemo(
    () => Object.values(itemsBySection).reduce((n, arr) => n + arr.length, 0),
    [itemsBySection]
  );

  return (
    <div style={{ height: '100vh', background: '#f4f6fb' }}>
      <SerpentineSectionList
        title={`Serpentine Sections (${total} items)`}
        description="Bottom-up leftward snake, with configurable mapping and same-section-only reordering."
        sections={sections}
        itemsBySection={itemsBySection}
        rowHeight={64}
        mode="promptExamples"
        onItemsReorder={(sectionId, nextItems) => {
          setItemsBySection((prev) => ({ ...prev, [sectionId]: nextItems }));
        }}
      />
    </div>
  );
}

const mount = document.getElementById('serpentine-root');
if (mount) {
  createRoot(mount).render(<DemoApp />);
}
