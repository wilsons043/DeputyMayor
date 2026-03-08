import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { db } from '@/lib/db';
import { useCapture } from '@/context/CaptureContext';
import { SlideLayoutPicker, type SlideLayoutId } from '@/components/SlideLayoutPicker';
import { SlideLandmark, SlideBriefing, SlideImpact, SlideDataPoint } from '@/components/SlideLayouts';

export function SlideStudio() {
  const slideRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SlideLayoutId>('landmark');
  const [scanUrl, setScanUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const { latestCapture, setLatestCapture } = useCapture();

  useEffect(() => {
    if (latestCapture) return;
    db.fieldCaptures.orderBy('createdAt').reverse().first().then((capture) => {
      if (capture) {
        try {
          const response = JSON.parse(capture.geminiResponse);
          setLatestCapture({
            ...response,
            topic: capture.topic,
            captureId: capture.id,
            photoPreviews: capture.imageBase64s ?? (capture.imageBase64 ? [capture.imageBase64] : undefined),
          });
        } catch {
          // ignore
        }
      }
    });
  }, [latestCapture, setLatestCapture]);

  const handleDownload = async () => {
    if (!slideRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(slideRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0f2847',
        logging: false,
        imageTimeout: 0,
      });
      const link = document.createElement('a');
      link.download = `council-slide-${layout}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const punchline = latestCapture?.slideTitle ?? latestCapture?.topic ?? 'Monthly Council Meeting';
  const body = latestCapture?.slideBody ?? '• Add content via Field Capture\n• Upload a photo and topic to generate this slide';
  const mainPhoto = latestCapture?.photoPreviews?.[0] ?? null;

  return (
    <section aria-labelledby="slide-studio-heading" style={{ maxWidth: 800 }}>
      <h2 id="slide-studio-heading" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Slide Studio
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Choose a 16:9 municipal layout. Punchline text is limited to 15 words. Content comes from your latest field
        capture. Download as high-resolution PNG for the City Hall projector.
      </p>

      <SlideLayoutPicker value={layout} onChange={setLayout} />

      {layout === 'data-point' && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>
            URL for QR code (Scan for Details)
            <input
              type="url"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              placeholder="https://yoursite.com/event-details"
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: '0.9375rem',
              }}
            />
          </label>
        </div>
      )}

      <div
        style={{
          marginBottom: '1rem',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {layout === 'landmark' && (
          <SlideLandmark ref={slideRef} punchline={punchline} body={body} mainPhoto={mainPhoto} />
        )}
        {layout === 'briefing' && (
          <SlideBriefing ref={slideRef} punchline={punchline} body={body} mainPhoto={mainPhoto} />
        )}
        {layout === 'impact' && (
          <SlideImpact ref={slideRef} punchline={punchline} body={body} mainPhoto={mainPhoto} />
        )}
        {layout === 'data-point' && (
          <SlideDataPoint
            ref={slideRef}
            punchline={punchline}
            body={body}
            mainPhoto={mainPhoto}
            scanUrl={scanUrl}
          />
        )}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        style={{
          padding: '0.6rem 1.25rem',
          background: downloading ? '#9ca3af' : '#1e3a5f',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          cursor: downloading ? 'wait' : 'pointer',
          fontSize: '0.9375rem',
        }}
      >
        {downloading ? 'Preparing…' : 'Download as image (PNG)'}
      </button>
    </section>
  );
}
