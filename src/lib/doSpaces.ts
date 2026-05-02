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

async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data =
    typeof input === "string"
      ? enc.encode(input)
      : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(keyBytes: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const keyData = keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
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
    body: bodyBytes ? bodyBytes : undefined,
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
