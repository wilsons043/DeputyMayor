/**
 * Google Drive integration for Deputy Mayor 2.0 (Google Drive Access tier).
 * Uses OAuth 2.0 with scope drive.file (app-created files only).
 * Tokens stored in sessionStorage (cleared when tab closes); no refresh without backend.
 */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Deputy Mayor Assets';
const TOKEN_KEY = 'deputy_mayor_drive_token';
const TOKEN_EXPIRY_KEY = 'deputy_mayor_drive_token_expiry';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const STORAGE_TIER_KEY = 'storageTier';
export type StorageTier = 'local' | 'drive';

/** Get client ID from env. Must be set for Drive tier. */
export function getGoogleClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
}

/** Get access token from sessionStorage. Returns null if missing or expired (with 60s buffer). */
export function getStoredAccessToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    const expiresAt = parseInt(expiry, 10);
    if (Date.now() >= expiresAt - 60_000) return null; // 60s buffer
    return token;
  } catch {
    return null;
  }
}

/** Store token in sessionStorage (not localStorage for security). */
export function setStoredAccessToken(token: string, expiresInSeconds: number): void {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
}

/** Clear stored Drive token. */
export function clearStoredAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/** Request OAuth token via Google Identity Services (Token Client). Call after loading GSI script. */
export function requestDriveToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const g = (window as Window & { google?: { accounts: { oauth2: { initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: { access_token: string; expires_in: number }) => void;
    }) => { requestAccessToken: () => void } } } } }).google;
    if (!g?.accounts?.oauth2?.initTokenClient) {
      reject(new Error('Google Identity Services script not loaded. Check VITE_GOOGLE_CLIENT_ID and script src.'));
      return;
    }
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          setStoredAccessToken(response.access_token, response.expires_in ?? 3600);
          resolve(response.access_token);
        } else {
          reject(new Error('No access token in response'));
        }
      },
    });
    client.requestAccessToken();
  });
}

/** Ensure GSI script is loaded, then request token. */
export function connectGoogleDrive(): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in .env'));

  return loadGSIScript().then(() => requestDriveToken(clientId));
}

function loadGSIScript(): Promise<void> {
  if ((window as Window & { __gsiLoaded?: boolean }).__gsiLoaded) return Promise.resolve();
  const g = (window as Window & { google?: { accounts?: unknown } }).google;
  if (g?.accounts) {
    (window as Window & { __gsiLoaded?: boolean }).__gsiLoaded = true;
    return Promise.resolve();
  }
  const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const tick = () => {
        if ((window as Window & { google?: { accounts?: unknown } }).google?.accounts) {
          (window as Window & { __gsiLoaded?: boolean }).__gsiLoaded = true;
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error('Google Identity Services did not load in time'));
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      (window as Window & { __gsiLoaded?: boolean }).__gsiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

async function driveFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  return res;
}

/** Find folder by name in root, or create it. Returns folder id. */
export async function getOrCreateDeputyMayorFolder(token: string): Promise<string> {
  const q = `name='${FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
  const listUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
  const listRes = await driveFetch(listUrl, token);
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Drive list failed: ${listRes.status} ${err}`);
  }
  const listJson = await listRes.json();
  const files = listJson.files as Array<{ id: string; name: string }>;
  if (files?.length > 0) return files[0].id;

  const createRes = await driveFetch(DRIVE_API_BASE + '/files', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Drive create folder failed: ${createRes.status} ${err}`);
  }
  const createJson = await createRes.json();
  return createJson.id as string;
}

/** Upload a file (blob or base64) to a Drive folder. Returns file id. */
export async function uploadToDrive(
  token: string,
  folderId: string,
  fileName: string,
  blob: Blob,
  mimeType: string
): Promise<string> {
  const boundary = 'deputy_mayor_upload_' + Date.now();
  const meta = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const res = await driveFetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, token, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.id as string;
}

/** Data for one field capture to upload to Drive. */
export interface CaptureUploadPayload {
  topic: string;
  description?: string;
  imageBase64s: string[];
  geminiResponse: string;
  createdAt: number;
}

/** Upload a field capture to Deputy Mayor Assets: one JSON file + image files. */
export async function uploadCaptureToDrive(payload: CaptureUploadPayload): Promise<void> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Not connected to Google Drive. Connect in Settings first.');

  const folderId = await getOrCreateDeputyMayorFolder(token);
  const timestamp = new Date(payload.createdAt).toISOString().replace(/[:.]/g, '-');
  const safeTopic = payload.topic.replace(/[^\w\s-]/g, '').slice(0, 40).trim() || 'capture';
  const prefix = `Capture_${safeTopic}_${timestamp}`;

  const jsonBlob = new Blob(
    [
      JSON.stringify(
        {
          topic: payload.topic,
          description: payload.description,
          geminiResponse: JSON.parse(payload.geminiResponse),
          createdAt: payload.createdAt,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  await uploadToDrive(token, folderId, `${prefix}_response.json`, jsonBlob, 'application/json');

  for (let i = 0; i < payload.imageBase64s.length; i++) {
    const dataUrl = payload.imageBase64s[i];
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: mimeType });
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const name = payload.imageBase64s.length > 1 ? `${prefix}_${i + 1}.${ext}` : `${prefix}.${ext}`;
    await uploadToDrive(token, folderId, name, blob, mimeType);
  }
}
