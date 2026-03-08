import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useCapture } from '@/context/CaptureContext';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
  { id: 'instagram', label: 'Instagram', icon: '📷' },
] as const;

/** Opens the platform's compose/share page in a new tab. X gets pre-filled text; Facebook/LinkedIn open share dialog (post text is copied so you can paste). */
function openPostOnPlatform(platformId: string, text: string): void {
  let url: string;
  if (platformId === 'x') {
    url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  } else if (platformId === 'facebook') {
    url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
  } else if (platformId === 'linkedin') {
    url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
  } else if (platformId === 'instagram') {
    url = 'https://www.instagram.com/';
  } else return;
  // For Facebook/LinkedIn/Instagram the share dialog doesn't pre-fill post text; copy it so user can paste.
  if (platformId === 'facebook' || platformId === 'linkedin' || platformId === 'instagram') {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function SocialMediaKit() {
  const { latestCapture, setLatestCapture } = useCapture();
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  const posts = latestCapture
    ? [
        { id: 'facebook' as const, text: latestCapture.facebook },
        { id: 'linkedin' as const, text: latestCapture.linkedin },
        { id: 'x' as const, text: latestCapture.x },
        { id: 'instagram' as const, text: latestCapture.instagram ?? latestCapture.facebook ?? 'Post not generated.' },
      ]
    : [];

  return (
    <section aria-labelledby="social-kit-heading" style={{ maxWidth: 640 }}>
      <h2 id="social-kit-heading" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Social Media Kit
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Preview how each post will look, then click <strong>Yes, copy this</strong> when you’re ready to paste it on
        that platform. Or use <strong>Post on Facebook / LinkedIn / X / Instagram</strong> to open that site and post directly (X opens with the text pre-filled; caption is copied for the others).
      </p>

      {posts.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '1.5rem', background: '#f9fafb', borderRadius: 8 }}>
          No content yet. Use <strong>Field Capture Dashboard</strong> to upload a photo and topic, then come back
          here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {latestCapture?.photoPreviews && latestCapture.photoPreviews.length > 0 && (
            <div style={{ padding: '1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                Latest capture
              </div>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{latestCapture.topic}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {latestCapture.photoPreviews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Capture ${i + 1}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {posts.map(({ id, text }) => (
            <PlatformPreview
              key={id}
              platformId={id}
              platformLabel={PLATFORMS.find((p) => p.id === id)!.label}
              platformIcon={PLATFORMS.find((p) => p.id === id)!.icon}
              text={text}
              isCopied={copiedId === id}
              onCopy={() => copyToClipboard(text, id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlatformPreview({
  platformId,
  platformLabel,
  platformIcon,
  text,
  isCopied,
  onCopy,
}: {
  platformId: string;
  platformLabel: string;
  platformIcon: string;
  text: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  if (platformId === 'facebook') {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
          {platformIcon} {platformLabel} preview
        </div>
        <div style={{ padding: '1rem', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1877f2 0%, #0d5bb5 100%)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Your Page</div>
              <div style={{ fontSize: '0.75rem', color: '#65676b' }}>{'Just now \u00B7 Globe'}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.4, color: '#050505', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #e4e6eb', fontSize: '0.8125rem', color: '#65676b' }}>
            <span>Like</span><span>Comment</span><span>Share</span>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isCopied ? '#059669' : '#1877f2',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isCopied ? 'Copied! Paste it on Facebook.' : 'Yes, copy this'}
          </button>
          <button
            type="button"
            onClick={() => openPostOnPlatform('facebook', text)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#1877f2',
              border: '1px solid #1877f2',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Post on Facebook
          </button>
        </div>
      </div>
    );
  }

  if (platformId === 'linkedin') {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
          {platformIcon} {platformLabel} preview
        </div>
        <div style={{ padding: '1rem', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Your Name</div>
              <div style={{ fontSize: '0.8125rem', color: '#666' }}>{'Your headline \u00B7 1st'}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.5, color: '#000000', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #e0e0e0', fontSize: '0.8125rem', color: '#666' }}>
            <span>Like</span><span>Comment</span><span>Repost</span><span>Send</span>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isCopied ? '#059669' : '#0a66c2',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isCopied ? 'Copied! Paste it on LinkedIn.' : 'Yes, copy this'}
          </button>
          <button
            type="button"
            onClick={() => openPostOnPlatform('linkedin', text)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#0a66c2',
              border: '1px solid #0a66c2',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Post on LinkedIn
          </button>
        </div>
      </div>
    );
  }

  if (platformId === 'x') {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
          {platformIcon} {platformLabel} preview
        </div>
        <div style={{ padding: '1rem', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#0f1419',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Your Name</span>
                <span style={{ fontSize: '0.8125rem', color: '#536471' }}>{'\u0040yourhandle'}</span>
                <span style={{ fontSize: '0.8125rem', color: '#536471' }}>{'\u00B7 now'}</span>
              </div>
              <div style={{ fontSize: '0.9375rem', lineHeight: 1.4, color: '#0f1419', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {text}
              </div>
              <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', paddingTop: '0.5rem', fontSize: '0.8125rem', color: '#536471' }}>
                <span>💬</span><span>↻</span><span>♥</span><span>📤</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isCopied ? '#059669' : '#0f1419',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isCopied ? 'Copied! Paste it on X.' : 'Yes, copy this'}
          </button>
          <button
            type="button"
            onClick={() => openPostOnPlatform('x', text)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#0f1419',
              border: '1px solid #0f1419',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Post on X (Twitter)
          </button>
        </div>
      </div>
    );
  }

  if (platformId === 'instagram') {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
          {platformIcon} {platformLabel} preview
        </div>
        <div style={{ padding: '1rem', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Your account</div>
              <div style={{ fontSize: '0.75rem', color: '#8e8e8e' }}>Caption</div>
            </div>
          </div>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.5, color: '#262626', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #efefef', fontSize: '0.8125rem', color: '#8e8e8e' }}>
            <span>♥ Like</span><span>💬 Comment</span><span>↗ Share</span>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: isCopied ? '#059669' : '#E1306C',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isCopied ? 'Copied! Paste it on Instagram.' : 'Yes, copy this'}
          </button>
          <button
            type="button"
            onClick={() => openPostOnPlatform('instagram', text)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#dd2a7b',
              border: '1px solid #dd2a7b',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Post on Instagram
          </button>
        </div>
      </div>
    );
  }

  return null;
}
