import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import {
  STORAGE_TIER_KEY,
  type StorageTier,
  getGoogleClientId,
  getStoredAccessToken,
  connectGoogleDrive,
  clearStoredAccessToken,
} from '@/lib/drive';

export function Settings() {
  const [tier, setTier] = useState<StorageTier>('local');
  const [loaded, setLoaded] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);

  useEffect(() => {
    getSetting(STORAGE_TIER_KEY).then((value) => {
      setTier((value as StorageTier) || 'local');
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    setDriveConnected(!!getStoredAccessToken());
  }, [loaded, tier]);

  const handleTierChange = useCallback(
    (newTier: StorageTier) => {
      setTier(newTier);
      setSetting(STORAGE_TIER_KEY, newTier);
      setDriveError(null);
      if (newTier === 'local') setDriveConnected(false);
    },
    []
  );

  const handleConnectDrive = useCallback(async () => {
    setDriveError(null);
    setDriveConnecting(true);
    try {
      await connectGoogleDrive();
      setDriveConnected(true);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to connect');
      setDriveConnected(false);
    } finally {
      setDriveConnecting(false);
    }
  }, []);

  const handleDisconnectDrive = useCallback(() => {
    clearStoredAccessToken();
    setDriveConnected(false);
    setDriveError(null);
  }, []);

  const hasClientId = !!getGoogleClientId();

  return (
    <section aria-labelledby="settings-heading" style={{ maxWidth: 520 }}>
      <h2 id="settings-heading" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Settings
      </h2>

      {loaded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              padding: '1.25rem',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>
              Storage (Two-tier)
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Choose where field captures and assets are stored. Local keeps everything in this browser only. Google
              Drive Access uploads captures to a folder in your Drive.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: `2px solid ${tier === 'local' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: tier === 'local' ? '#eff6ff' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name="storage-tier"
                  checked={tier === 'local'}
                  onChange={() => handleTierChange('local')}
                />
                <div>
                  <span style={{ fontWeight: 600 }}>Local storage</span>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}> (Standard)</span>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Data stays in this device only (Dexie/IndexedDB).
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: `2px solid ${tier === 'drive' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: tier === 'drive' ? '#eff6ff' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name="storage-tier"
                  checked={tier === 'drive'}
                  onChange={() => handleTierChange('drive')}
                />
                <div>
                  <span style={{ fontWeight: 600 }}>Google Drive Access</span>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Captures are uploaded to a folder in your Google Drive.
                  </div>
                </div>
              </label>
            </div>

            {tier === 'drive' && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                {!hasClientId ? (
                  <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                    Add <code style={{ background: '#fef2f2', padding: '0.1rem 0.3rem', borderRadius: 4 }}>
                      VITE_GOOGLE_CLIENT_ID
                    </code>{' '}
                    to your <code>.env</code> and restart the dev server to enable Google Drive Access.
                  </p>
                ) : (
                  <>
                    {driveConnected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                          ✓ Google Drive connected
                        </span>
                        <button
                          type="button"
                          onClick={handleDisconnectDrive}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8125rem',
                            background: '#f3f4f6',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectDrive}
                        disabled={driveConnecting}
                        style={{
                          padding: '0.5rem 1rem',
                          background: driveConnecting ? '#9ca3af' : '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 500,
                          cursor: driveConnecting ? 'wait' : 'pointer',
                          fontSize: '0.9375rem',
                        }}
                      >
                        {driveConnecting ? 'Connecting…' : 'Connect Google Drive'}
                      </button>
                    )}
                    {driveError && (
                      <p style={{ fontSize: '0.875rem', color: '#b91c1c', marginTop: '0.5rem' }} role="alert">
                        {driveError}
                      </p>
                    )}
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                      Uses scope <code>drive.file</code> (only files this app creates). Token is stored in session
                      storage and cleared when you close the tab.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
