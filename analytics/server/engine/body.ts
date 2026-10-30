/**
 * Size-limited request body reading. Unlike h3's `readBody`, this stops
 * reading (413) as soon as the limit is passed, so a huge or endless body
 * can't fill memory.
 */
import { createError, getRequestHeader, getRequestWebStream, type H3Event } from "h3";

/** Public hit ingestion (`/api/stats`). Real hits are well under 4 KB. */
export const STATS_BODY_LIMIT = 32 * 1024;
/** Default for admin, share and v1 API routes. */
export const API_BODY_LIMIT = 64 * 1024;

const tooLarge = (maxBytes: number) =>
  createError({ statusCode: 413, statusMessage: `Request body too large (max ${Math.round(maxBytes / 1024)} KB)` });

/** Reads the raw body as UTF-8 text, or null when there is none. */
export const readLimitedText = async (event: H3Event, maxBytes: number): Promise<string | null> => {
  const declared = Number(getRequestHeader(event, "content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);
  const stream = getRequestWebStream(event);
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk: Uint8Array = typeof value === "string" ? Buffer.from(value) : value;
    size += chunk.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge(maxBytes);
    }
    chunks.push(chunk);
  }
  return size ? Buffer.concat(chunks).toString("utf8") : null;
};

/** Reads and parses a JSON body; returns the raw text when it isn't valid JSON. */
export const readLimitedBody = async (event: H3Event, maxBytes: number): Promise<unknown> => {
  const text = await readLimitedText(event, maxBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
