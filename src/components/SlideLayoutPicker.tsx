import { MUNI } from '@/lib/slideTheme';

export type SlideLayoutId = 'landmark' | 'briefing' | 'impact' | 'data-point';

export const SLIDE_LAYOUTS: { id: SlideLayoutId; name: string; description: string }[] = [
  { id: 'landmark', name: 'The Landmark', description: 'Title slide: full-bleed photo, centered punchline' },
  { id: 'briefing', name: 'The Briefing', description: 'Split: photo left, Quick Facts right' },
  { id: 'impact', name: 'The Impact', description: 'Feature: main photo, big action statement' },
  { id: 'data-point', name: 'The Data Point', description: 'Call to action: photo + QR/URL' },
];

export function SlideLayoutPicker({
  value,
  onChange,
}: {
  value: SlideLayoutId;
  onChange: (id: SlideLayoutId) => void;
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
        Slide layout
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
        {SLIDE_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            onClick={() => onChange(layout.id)}
            style={{
              padding: '0.65rem 0.75rem',
              textAlign: 'left',
              border: `2px solid ${value === layout.id ? MUNI.gold : '#e5e7eb'}`,
              borderRadius: 8,
              background: value === layout.id ? 'rgba(201, 162, 39, 0.12)' : '#fff',
              color: value === layout.id ? MUNI.blue : '#374151',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: value === layout.id ? 600 : 500,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{layout.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.2 }}>{layout.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
