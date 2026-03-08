/**
 * Gemini API client for Field Capture: send photo + topic, receive
 * social posts (FB, LinkedIn, X) and slide content for council meetings.
 * Uses the official @google/genai SDK with the stable v1 API and gemini-2.5-flash.
 */

import { GoogleGenAI } from '@google/genai';
import type { GeminiCaptureResponse } from './db';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/** Current stable model on v1 API (gemini-2.0-flash deprecated for new users). */
const GEMINI_MODEL = 'gemini-2.5-flash';

const PROMPT = `You are a municipal communications assistant. Given one or more photos from a field visit or community event, plus a topic and a description of what is actually happening, generate:

1. A Facebook post (2-4 sentences, friendly and engaging, with a clear call-to-action or takeaway). Base it on the real situation described.
2. A LinkedIn post (professional tone, 2-3 short paragraphs, suitable for government/civic audience). Reflect what is actually happening.
3. An X (Twitter) post (under 280 characters, punchy and shareable).
4. An Instagram caption (short, engaging, 1-2 sentences; can include a few relevant hashtags). Suited for a photo post.

5. A slide for a monthly council meeting in two parts:
   - slideTitle: A short title (one line) for the slide.
   - slideBody: 3-5 bullet points summarizing what is actually happening for the council (concise, factual).

Respond with ONLY a valid JSON object (no markdown, no code fence) with exactly these keys, all strings:
"facebook", "linkedin", "x", "instagram", "slideTitle", "slideBody"`;

export interface ImageInput {
  base64: string;
  mimeType: string;
}

/**
 * Send one or more photos (base64), topic, and description to Gemini; return structured social + slide content.
 * Supports up to 10 images. Requires VITE_GEMINI_API_KEY in .env. If missing, returns mock data.
 */
export async function submitFieldCaptureToGemini(
  images: ImageInput[],
  topic: string,
  description: string
): Promise<GeminiCaptureResponse> {
  if (!images.length) throw new Error('At least one image is required');

  if (!GEMINI_API_KEY) {
    return getMockGeminiResponse(topic, description);
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: 'v1',
  });

  const context = description.trim()
    ? `Topic: ${topic}\n\nDescription of what's actually happening: ${description.trim()}`
    : `Topic: ${topic}`;

  const imageParts = images.map((img) => {
    const rawBase64 = img.base64.replace(/^data:image\/\w+;base64,/, '');
    return {
      inlineData: {
        mimeType: img.mimeType || 'image/jpeg',
        data: rawBase64,
      },
    };
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      ...imageParts,
      {
        text: `${PROMPT}\n\n${context}`,
      },
    ],
    config: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  const text = response.text;
  if (!text) throw new Error('No text in Gemini response');

  const raw = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: Record<string, unknown>;
  try {
    const jsonStr = extractJson(raw);
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    throw new Error(`Gemini response could not be parsed: ${msg}. Response snippet: ${raw.slice(0, 200)}...`);
  }

  const result = normalizeGeminiResponse(parsed);
  if (!result) {
    throw new Error(
      `Gemini response missing required fields (facebook, linkedin, x, instagram, slideTitle, slideBody). Got keys: ${Object.keys(parsed).join(', ')}`
    );
  }
  return result;
}

/** Try to extract a single JSON object from text (handles markdown or leading/trailing text). */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  let quoteChar = '';
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (inString) {
      if (c === quoteChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quoteChar = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return text;
  return text.slice(start, end + 1);
}

/** Normalize model output to GeminiCaptureResponse; accept common alternate keys and coerce to string. */
function normalizeGeminiResponse(parsed: Record<string, unknown>): GeminiCaptureResponse | null {
  const str = (v: unknown): string =>
    typeof v === 'string' ? v : v != null ? String(v) : '';
  const facebook = str(parsed.facebook ?? parsed.Facebook ?? parsed.fb ?? '');
  const linkedin = str(parsed.linkedin ?? parsed.LinkedIn ?? parsed.linkedIn ?? '');
  const x = str(parsed.x ?? parsed.twitter ?? parsed.X ?? parsed.Twitter ?? '');
  const instagram = str(parsed.instagram ?? parsed.Instagram ?? parsed.ig ?? '');
  const slideTitle = str(parsed.slideTitle ?? parsed.slide_title ?? '');
  const slideBody = str(parsed.slideBody ?? parsed.slide_body ?? '');

  if (!facebook && !linkedin && !x && !slideTitle && !slideBody) return null;
  return {
    facebook: facebook || 'Post not generated.',
    linkedin: linkedin || 'Post not generated.',
    x: x || 'Post not generated.',
    instagram: instagram || 'Post not generated.',
    slideTitle: slideTitle || 'Field Update',
    slideBody: slideBody || '• See topic and description above.',
  };
}

function getMockGeminiResponse(topic: string, description?: string): GeminiCaptureResponse {
  const summary = description?.trim() ? description.trim().slice(0, 120) + (description.length > 120 ? '…' : '') : 'Summary from community visit';
  return {
    facebook: `Today we visited the community to discuss ${topic}. ${summary} Grateful for the conversation—share your thoughts in the comments!`,
    linkedin: `As part of our ongoing community engagement, we focused this week on ${topic}. ${summary}\n\nWe're committed to transparency and dialogue.`,
    x: `Field update: ${topic}. ${summary.slice(0, 80)} 🏛️`,
    instagram: `Community update: ${topic}. ${summary.slice(0, 100)} #LocalGovernment #Community`,
    slideTitle: `Field Update: ${topic}`,
    slideBody: `• Topic: ${topic}\n• ${summary}\n• Key points for council consideration\n• Next steps`,
  };
}
