import { forwardRef } from 'react';
import { MUNI, toPunchline, bulletPoints } from '@/lib/slideTheme';

export interface SlideLayoutProps {
  punchline: string;
  body: string;
  mainPhoto: string | null;
  scanUrl?: string;
}

const slideBase = {
  width: '100%',
  aspectRatio: '16 / 9',
  boxSizing: 'border-box' as const,
  overflow: 'hidden' as const,
  position: 'relative' as const,
  color: MUNI.white,
};

/** The Landmark: full-bleed background photo, overlay, centered punchline */
export const SlideLandmark = forwardRef<HTMLDivElement, SlideLayoutProps>(function SlideLandmark(
  { punchline, mainPhoto },
  ref
) {
  const line = toPunchline(punchline);
  return (
    <div
      ref={ref}
      style={{
        ...slideBase,
        background: mainPhoto ? `url(${mainPhoto}) center/cover` : MUNI.blue,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: MUNI.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(1.5rem, 5vw, 4rem)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            textAlign: 'center',
            textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            maxWidth: '90%',
          }}
        >
          {line}
        </h2>
      </div>
    </div>
  );
});

/** The Briefing: photo left, Quick Facts right */
export const SlideBriefing = forwardRef<HTMLDivElement, SlideLayoutProps>(function SlideBriefing(
  { punchline, body, mainPhoto },
  ref
) {
  const bullets = bulletPoints(body, 3);
  const line = toPunchline(punchline);
  return (
    <div
      ref={ref}
      style={{
        ...slideBase,
        display: 'flex',
        flexDirection: 'row',
        background: MUNI.blue,
      }}
    >
      <div style={{ flex: '1 1 55%', minWidth: 0, background: mainPhoto ? `url(${mainPhoto}) center/cover` : MUNI.blueMid }} />
      <div
        style={{
          flex: '0 0 45%',
          background: MUNI.blueMid,
          borderLeft: `4px solid ${MUNI.gold}`,
          padding: 'clamp(1rem, 3vw, 2.5rem)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(0.7rem, 1.8vw, 0.9rem)',
            color: MUNI.goldLight,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          Quick Facts
        </div>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', fontWeight: 800 }}>
          {line}
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'clamp(0.75rem, 1.8vw, 1rem)', lineHeight: 1.6 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: '0.35rem' }}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
});

/** The Impact: social proof icon corner, main photo center, big action statement bottom */
export const SlideImpact = forwardRef<HTMLDivElement, SlideLayoutProps>(function SlideImpact(
  { punchline, mainPhoto },
  ref
) {
  const line = toPunchline(punchline);
  return (
    <div
      ref={ref}
      style={{
        ...slideBase,
        background: MUNI.blue,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'clamp(0.5rem, 2vw, 1rem)',
          right: 'clamp(0.5rem, 2vw, 1rem)',
          width: 'clamp(2rem, 5vw, 3rem)',
          height: 'clamp(2rem, 5vw, 3rem)',
          borderRadius: 8,
          background: MUNI.gold,
          color: MUNI.blue,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(0.9rem, 2.2vw, 1.25rem)',
          fontWeight: 800,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
        aria-hidden
      >
        ✓
      </div>
      <div
        style={{
          flex: 1,
          margin: 'clamp(2rem, 6vw, 4rem)',
          marginBottom: '0.5rem',
          background: mainPhoto ? `url(${mainPhoto}) center/cover` : MUNI.blueMid,
          borderRadius: 8,
          minHeight: 0,
        }}
      />
      <div
        style={{
          padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(1.5rem, 4vw, 2.5rem)',
          background: `linear-gradient(90deg, ${MUNI.gold} 0%, ${MUNI.goldLight} 100%)`,
          color: MUNI.blue,
        }}
      >
        <div
          style={{
            fontSize: 'clamp(1.25rem, 3.5vw, 2.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {line}
        </div>
      </div>
    </div>
  );
});

/** The Data Point: photo left, QR/URL right, "Scan for Details" */
export const SlideDataPoint = forwardRef<HTMLDivElement, SlideLayoutProps>(function SlideDataPoint(
  { punchline, mainPhoto, scanUrl },
  ref
) {
  const line = toPunchline(punchline);
  const url = scanUrl?.trim() || 'https://example.com/details';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  return (
    <div
      ref={ref}
      style={{
        ...slideBase,
        display: 'flex',
        flexDirection: 'row',
        background: MUNI.blue,
      }}
    >
      <div
        style={{
          flex: '1 1 55%',
          minWidth: 0,
          background: mainPhoto ? `url(${mainPhoto}) center/cover` : MUNI.blueMid,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      <div
        style={{
          flex: '0 0 45%',
          padding: 'clamp(1rem, 3vw, 2rem)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: `4px solid ${MUNI.gold}`,
        }}
      >
        <div
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
            fontWeight: 800,
            color: MUNI.goldLight,
            marginBottom: '0.75rem',
            textAlign: 'center',
          }}
        >
          Scan for Details
        </div>
        <div
          style={{
            width: 'clamp(100px, 18vw, 160px)',
            height: 'clamp(100px, 18vw, 160px)',
            background: '#fff',
            borderRadius: 8,
            padding: 8,
            marginBottom: '0.5rem',
          }}
        >
          <img src={qrSrc} alt="QR code" width="100%" height="100%" style={{ display: 'block' }} crossOrigin="anonymous" />
        </div>
        <div style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.8rem)', color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all', textAlign: 'center' }}>
          {url}
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: 'clamp(0.7rem, 1.6vw, 0.9rem)', fontWeight: 600, textAlign: 'center' }}>
          {line}
        </div>
      </div>
    </div>
  );
});
