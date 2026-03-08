import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import { NewsletterEngine } from './NewsletterEngine';

const BUSINESS_SPOTLIGHT_KEY = 'businessSpotlight';

export function MasterNewsletter() {
  const [spotlight, setSpotlight] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSetting(BUSINESS_SPOTLIGHT_KEY).then((value) => {
      setSpotlight(value ?? '');
      setLoaded(true);
    });
  }, []);

  const saveSpotlight = useCallback(() => {
    setSetting(BUSINESS_SPOTLIGHT_KEY, spotlight);
  }, [spotlight]);

  return (
    <section aria-labelledby="master-newsletter-heading" style={{ maxWidth: 900 }}>
      <h2 id="master-newsletter-heading" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Master Newsletter
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Awareness campaigns, captured events, and meeting dates in one timeline, plus an optional Business Spotlight.
      </p>

      <NewsletterEngine />

      <div style={{ marginTop: '2rem', padding: '1.25rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Business Spotlight</h3>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          Optional section to highlight a local business or partner. Edit below and it will be saved locally.
        </p>
        {loaded && (
          <>
            <textarea
              value={spotlight}
              onChange={(e) => setSpotlight(e.target.value)}
              onBlur={saveSpotlight}
              placeholder="e.g. This month we shine a light on Main Street Café—thank you for supporting our downtown."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
              Saved automatically when you leave the field.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
