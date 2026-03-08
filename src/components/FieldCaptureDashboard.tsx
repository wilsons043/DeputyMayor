import { useState, useRef } from 'react';
import { db, getSetting } from '@/lib/db';
import { submitFieldCaptureToGemini } from '@/lib/gemini';
import { useCapture } from '@/context/CaptureContext';
import { STORAGE_TIER_KEY, uploadCaptureToDrive } from '@/lib/drive';

const MAX_PHOTOS = 10;

type PhotoEntry = { file: File; preview: string };

export function FieldCaptureDashboard() {
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setLatestCapture } = useCapture();

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const next: PhotoEntry[] = [...photos];
    for (let i = 0; i < files.length && next.length < MAX_PHOTOS; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const preview = URL.createObjectURL(file);
      next.push({ file, preview });
    }
    if (next.length === photos.length && files.length > 0) {
      setError('Please choose only image files (JPEG, PNG, etc.).');
    }
    setPhotos(next);
  };

  const removePhoto = (index: number) => {
    const entry = photos[index];
    if (entry?.preview) URL.revokeObjectURL(entry.preview);
    setPhotos(photos.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!topic.trim()) {
      setError('Please enter a topic.');
      return;
    }
    if (photos.length === 0) {
      setError('Please add at least one photo.');
      return;
    }

    setLoading(true);
    setDriveSyncError(null);
    try {
      const imageInputs = await Promise.all(
        photos.map((p) => {
          return new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              base64: reader.result as string,
              mimeType: p.file.type || 'image/jpeg',
            });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(p.file);
          });
        })
      );

      const response = await submitFieldCaptureToGemini(
        imageInputs,
        topic.trim(),
        description.trim()
      );

      const createdAt = Date.now();
      const base64List = imageInputs.map((i) => i.base64);
      const record = await db.fieldCaptures.add({
        topic: topic.trim(),
        description: description.trim() || undefined,
        imageBase64s: base64List,
        geminiResponse: JSON.stringify(response),
        createdAt,
      });

      const storageTier = await getSetting(STORAGE_TIER_KEY);
      if (storageTier === 'drive') {
        try {
          await uploadCaptureToDrive({
            topic: topic.trim(),
            description: description.trim() || undefined,
            imageBase64s: base64List,
            geminiResponse: JSON.stringify(response),
            createdAt,
          });
        } catch (driveErr) {
          setDriveSyncError(
            driveErr instanceof Error ? driveErr.message : 'Drive sync failed. Saved locally.'
          );
        }
      }

      setLatestCapture({
        ...response,
        topic: topic.trim(),
        captureId: record,
        photoPreviews: base64List,
      });
      setTopic('');
      setDescription('');
      setPhotos([]);
      photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to Gemini.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="field-capture-heading" style={{ maxWidth: 480 }}>
      <h2 id="field-capture-heading" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Field Capture Dashboard
      </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Add a topic, description, and your photos. When you’re finished adding photos, click <strong>Capture &amp;
        Generate</strong> to send. Nothing is sent until you click that button. Then go to <strong>Social Media
        Kit</strong> to copy each post.
      </p>

      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Topic</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Park renovation feedback, Small business roundtable"
            style={{
              padding: '0.65rem',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: '1rem',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>What’s actually happening</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Residents shared concerns about playground equipment; DPW was on site assessing the fence."
            rows={3}
            style={{
              padding: '0.65rem',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: '1rem',
              resize: 'vertical',
              minHeight: 72,
            }}
          />
        </label>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Photos</span>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
              {photos.length} / {MAX_PHOTOS}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files ?? null);
              e.target.value = '';
            }}
            style={{ padding: '0.5rem', border: '1px dashed #d1d5db', borderRadius: 8, background: '#fafafa', width: '100%', boxSizing: 'border-box' }}
          />
          {photos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {photos.map((entry, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img
                    src={entry.preview}
                    alt={`Preview ${index + 1}`}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && photos.length > 0 && (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.35rem', marginBottom: 0 }}>
              Add more photos if you want, then click <strong>Capture &amp; Generate</strong> below when you’re ready to send.
            </p>
          )}
        </div>

        {error && (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
            {error}
          </p>
        )}
        {driveSyncError && (
          <p style={{ color: '#b45309', fontSize: '0.875rem', margin: 0 }} role="status">
            {driveSyncError}
          </p>
        )}

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={loading || !topic.trim() || photos.length === 0}
          style={{
            padding: '0.75rem 1.25rem',
            background: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {loading ? 'Sending to Gemini…' : 'Capture & Generate'}
        </button>
      </form>
    </section>
  );
}
