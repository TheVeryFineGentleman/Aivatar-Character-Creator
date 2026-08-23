// DigitalOcean Spaces (S3-compatible) client.
// Hand-rolled AWS Signature V4 to avoid pulling the 50KB+ aws-sdk into the bundle.
// Used for project save/load: state.json, reference images, generated images, videos.
//
// Required env vars (Vite, prefix VITE_ so they're shipped to the browser):
//   VITE_DO_SPACES_KEY     - Access Key ID
//   VITE_DO_SPACES_SECRET  - Secret Access Key
//   VITE_DO_SPACES_REGION  - e.g. "fra1"
//   VITE_DO_SPACES_BUCKET  - bucket name
//   VITE_DO_SPACES_ENDPOINT (optional) - e.g. "fra1.digitaloceanspaces.com"
//
// CORS: the bucket's CORS config must allow the origins (localhost, prod domain)
// with PUT, GET, DELETE methods, plus headers Authorization, x-amz-content-sha256,
// x-amz-date, content-type.

const ACCESS_KEY = import.meta.env.VITE_DO_SPACES_KEY as string | undefined;
const SECRET_KEY = import.meta.env.VITE_DO_SPACES_SECRET as string | undefined;
const REGION = (import.meta.env.VITE_DO_SPACES_REGION as string | undefined) || "fra1";
const BUCKET = (import.meta.env.VITE_DO_SPACES_BUCKET as string | undefined) || "template-pictures-bucket";
const ENDPOINT_HOST =
  (import.meta.env.VITE_DO_SPACES_ENDPOINT as string | undefined) || `${REGION}.digitaloceanspaces.com`;
const SERVICE = "s3";

export const SPACES_PUBLIC_BASE = `https://${BUCKET}.${ENDPOINT_HOST}`;

export function isConfigured(): boolean {
  return !!ACCESS_KEY && !!SECRET_KEY && !!BUCKET;
}

let warnedNotConfigured = false;
function warnIfMissing() {
  if (isConfigured() || warnedNotConfigured) return;
  warnedNotConfigured = true;
  console.warn(
    "[doSpaces] VITE_DO_SPACES_KEY / VITE_DO_SPACES_SECRET nicht gesetzt. " +
    "Ergänze deine .env Datei und starte den Dev-Server neu."
  );
}

// ============================================================
// SIGNATURE V4 HELPERS
// ============================================================

const enc = new TextEncoder();
const dec = new TextDecoder();

// Detect whether Web Crypto's subtle API is available. It requires a "secure
// context" (HTTPS or localhost), so it's missing on http://192.168.x.x:8080 etc.
const SUBTLE_AVAILABLE = typeof crypto !== "undefined" && !!crypto.subtle;

// ── Pure-JS SHA-256 (fallback) ───────────────────────────────────────────────
// Verified bit-identical to Node's crypto + Web Crypto SHA-256. Used only when
// crypto.subtle is unavailable.
const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function sha256Bytes(input: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  const len = input.length;
  const totalLen = ((len + 9 + 63) >> 6) << 6;
  const msg = new Uint8Array(totalLen);
  msg.set(input);
  msg[len] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(totalLen - 4, (len * 8) >>> 0, false);
  const W = new Uint32Array(64);
  for (let chunk = 0; chunk < totalLen; chunk += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15], w2 = W[i - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i] >>> 0, false);
  return out;
}

function hmacSha256JS(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k = key.length > blockSize ? sha256Bytes(key) : key;
  const k0 = new Uint8Array(blockSize);
  k0.set(k);
  const ipad = new Uint8Array(blockSize), opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = k0[i] ^ 0x36;
    opad[i] = k0[i] ^ 0x5c;
  }
  const inner = new Uint8Array(ipad.length + msg.length);
  inner.set(ipad); inner.set(msg, ipad.length);
  const innerHash = sha256Bytes(inner);
  const outer = new Uint8Array(opad.length + innerHash.length);
  outer.set(opad); outer.set(innerHash, opad.length);
  return sha256Bytes(outer);
}

async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data =
    typeof input === "string"
      ? enc.encode(input)
      : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  if (SUBTLE_AVAILABLE) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", data as BufferSource);
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {/* fall through */}
  }
  return Array.from(sha256Bytes(data))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(keyBytes: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const keyData = keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes);
  if (SUBTLE_AVAILABLE) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg) as BufferSource);
    } catch {/* fall through */}
  }
  // JS fallback — return a value with the same ArrayBuffer interface.
  const out = hmacSha256JS(keyData, enc.encode(msg));
  // Make sure we return an ArrayBuffer (not a SharedArrayBuffer) view.
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function deriveSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(enc.encode("AWS4" + secret), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowAmzDates(): { amzDate: string; dateStamp: string } {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return { amzDate: `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`, dateStamp: `${yyyy}${mm}${dd}` };
}

function uriEncode(value: string, encodeSlash = true): string {
  return value.replace(/[^A-Za-z0-9\-._~]/g, (c) => {
    if (c === "/" && !encodeSlash) return c;
    return "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  });
}

interface SignedRequestOptions {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  key: string; // object key inside the bucket, e.g. "user123/p_abc/state.json"
  query?: Record<string, string>;
  body?: ArrayBuffer | Uint8Array | Blob;
  contentType?: string;
  acl?: "public-read" | "private";
}

async function signedFetch(opts: SignedRequestOptions): Promise<Response> {
  if (!isConfigured()) {
    warnIfMissing();
    throw new Error("DO Spaces nicht konfiguriert (VITE_DO_SPACES_KEY/SECRET fehlt).");
  }

  const { amzDate, dateStamp } = nowAmzDates();
  const host = `${BUCKET}.${ENDPOINT_HOST}`;

  // Read body bytes (if any) for content hash + Content-Length.
  let bodyBytes: Uint8Array | null = null;
  if (opts.body) {
    if (opts.body instanceof Blob) {
      bodyBytes = new Uint8Array(await opts.body.arrayBuffer());
    } else if (opts.body instanceof Uint8Array) {
      bodyBytes = opts.body;
    } else {
      bodyBytes = new Uint8Array(opts.body);
    }
  }
  const payloadHash = bodyBytes ? await sha256Hex(bodyBytes) : await sha256Hex("");

  // Canonical query string (sorted by key).
  const queryEntries = Object.entries(opts.query || {}).sort(([a], [b]) => a.localeCompare(b));
  const canonicalQuery = queryEntries
    .map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(v, true)}`)
    .join("&");

  // Path must be URI-encoded but slashes preserved.
  const canonicalUri = "/" + uriEncode(opts.key, false);

  // Headers (lowercase keys, sorted).
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  if (opts.acl) headers["x-amz-acl"] = opts.acl;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders =
    sortedHeaderKeys.map((k) => `${k}:${headers[k].trim()}`).join("\n") + "\n";
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(SECRET_KEY!, dateStamp, REGION, SERVICE);
  const signatureBuf = await hmac(signingKey, stringToSign);
  const signature = bufToHex(signatureBuf);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}${canonicalQuery ? "?" + canonicalQuery : ""}`;
  const fetchHeaders: Record<string, string> = {
    Authorization: authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (opts.contentType) fetchHeaders["Content-Type"] = opts.contentType;
  if (opts.acl) fetchHeaders["x-amz-acl"] = opts.acl;

  return fetch(url, {
    method: opts.method,
    headers: fetchHeaders,
    body: bodyBytes ? (bodyBytes as BodyInit) : undefined,
    // Bypass HTTP cache — DO Spaces signed URLs use the same path each time
    // (only the Authorization header changes), so the browser would otherwise
    // serve stale cached responses for repeated GETs.
    cache: "no-store",
  });
}

// ============================================================
// PUBLIC API
// ============================================================

export async function putObject(key: string, body: Blob | Uint8Array, contentType: string, isPublic = true): Promise<string> {
  const resp = await signedFetch({
    method: "PUT",
    key,
    body,
    contentType,
    acl: isPublic ? "public-read" : "private",
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DO Spaces PUT ${key} fehlgeschlagen (${resp.status}): ${errText.slice(0, 200)}`);
  }
  return `${SPACES_PUBLIC_BASE}/${key}`;
}

export async function putJson(key: string, value: unknown, isPublic = false): Promise<void> {
  const text = JSON.stringify(value);
  await putObject(key, new Blob([text], { type: "application/json" }), "application/json", isPublic);
}

export async function getObject(key: string): Promise<Blob | null> {
  const resp = await signedFetch({ method: "GET", key });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`DO Spaces GET ${key} fehlgeschlagen (${resp.status})`);
  return resp.blob();
}

export async function getJson<T = any>(key: string): Promise<T | null> {
  const blob = await getObject(key);
  if (!blob) return null;
  const text = await blob.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const resp = await signedFetch({ method: "DELETE", key });
  // S3 DELETE returns 204 on success, 404 is fine (idempotent).
  if (!resp.ok && resp.status !== 404) {
    const errText = await resp.text();
    throw new Error(`DO Spaces DELETE ${key} fehlgeschlagen (${resp.status}): ${errText.slice(0, 200)}`);
  }
}

// List all object keys under a prefix using ListObjectsV2.
// Returns just the keys (we don't need the rest).
export async function listKeys(prefix: string): Promise<string[]> {
  const collected: string[] = [];
  let continuationToken: string | undefined;
  do {
    const query: Record<string, string> = {
      "list-type": "2",
      prefix,
      "max-keys": "1000",
    };
    if (continuationToken) query["continuation-token"] = continuationToken;

    const resp = await signedFetch({ method: "GET", key: "", query });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`DO Spaces LIST ${prefix} fehlgeschlagen (${resp.status}): ${errText.slice(0, 200)}`);
    }
    const xml = await resp.text();
    // Extract <Key>...</Key> entries — minimal XML parsing without a DOM dep.
    const re = /<Key>([^<]+)<\/Key>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) collected.push(m[1]);
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    const truncMatch = xml.match(/<IsTruncated>([^<]+)<\/IsTruncated>/);
    if (truncMatch?.[1] === "true" && tokenMatch?.[1]) continuationToken = tokenMatch[1];
    else continuationToken = undefined;
  } while (continuationToken);
  return collected;
}

// List keys with their sizes — used for storage quota calculation.
export async function listKeysWithSize(prefix: string): Promise<Array<{ key: string; size: number }>> {
  const collected: Array<{ key: string; size: number }> = [];
  let continuationToken: string | undefined;
  do {
    const query: Record<string, string> = {
      "list-type": "2",
      prefix,
      "max-keys": "1000",
    };
    if (continuationToken) query["continuation-token"] = continuationToken;

    const resp = await signedFetch({ method: "GET", key: "", query });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`DO Spaces LIST ${prefix} fehlgeschlagen (${resp.status}): ${errText.slice(0, 200)}`);
    }
    const xml = await resp.text();
    // Match each <Contents> block and extract Key + Size
    const re = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      collected.push({ key: m[1], size: parseInt(m[2], 10) || 0 });
    }
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    const truncMatch = xml.match(/<IsTruncated>([^<]+)<\/IsTruncated>/);
    if (truncMatch?.[1] === "true" && tokenMatch?.[1]) continuationToken = tokenMatch[1];
    else continuationToken = undefined;
  } while (continuationToken);
  return collected;
}

// Bulk delete by listing and removing.
export async function deletePrefix(prefix: string): Promise<void> {
  const keys = await listKeys(prefix);
  if (keys.length === 0) return;
  // Sequential to keep it simple — these endpoints are fast enough.
  for (const k of keys) {
    try {
      await deleteObject(k);
    } catch (err) {
      console.warn(`[doSpaces] delete ${k} failed:`, err);
    }
  }
}

export function publicUrl(key: string): string {
  return `${SPACES_PUBLIC_BASE}/${key}`;
}

// Extract the object key from a public URL we previously returned.
export function keyFromPublicUrl(url: string): string | null {
  if (!url.startsWith(SPACES_PUBLIC_BASE + "/")) return null;
  return url.slice(SPACES_PUBLIC_BASE.length + 1);
}
