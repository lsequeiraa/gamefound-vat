// Uploads a zip to an existing Chrome Web Store item and submits it for review,
// authenticating as a Google Cloud service account (Chrome Web Store API v2).
//
//   CWS_SERVICE_ACCOUNT_JSON  the service account's JSON key
//   CWS_PUBLISHER_ID          Developer Dashboard → Account → Publisher ID
//   CWS_ITEM_ID               the extension's item ID in the store
//
//   bun run scripts/cws-publish.ts artifacts/gamefound-vat-1.0.1-chrome.zip
//   bun run scripts/cws-publish.ts --status     (read-only: checks the credentials)
import { createSign } from "node:crypto";

const API = "https://chromewebstore.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** A signed JWT asking Google for an access token with the Chrome Web Store scope. */
export function tokenAssertion(account: ServiceAccount, now = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

async function json(res: Response, what: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what} failed with ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

export async function accessToken(account: ServiceAccount, fetchFn: Fetch = fetch): Promise<string> {
  const res = await fetchFn(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: tokenAssertion(account),
    }),
  });
  return (await json(res, "Token request")).access_token;
}

export interface PublishOptions {
  token: string;
  publisherId: string;
  itemId: string;
  zip: Blob;
  fetchFn?: Fetch;
  pollMs?: number;
  maxPolls?: number;
  log?: (line: string) => void;
}

export async function uploadAndPublish(opts: PublishOptions): Promise<string> {
  const { token, zip, fetchFn = fetch, pollMs = 5000, maxPolls = 60, log = console.log } = opts;
  const name = `publishers/${opts.publisherId}/items/${opts.itemId}`;
  const auth = { Authorization: `Bearer ${token}` };

  const upload = await json(await fetchFn(`${API}/upload/v2/${name}:upload`, { method: "POST", headers: auth, body: zip }), "Upload");
  let state: string = upload.uploadState;
  log(`Upload: ${state}${upload.crxVersion ? ` (version ${upload.crxVersion})` : ""}`);
  for (let i = 0; state === "UPLOAD_IN_PROGRESS" && i < maxPolls; i++) {
    await Bun.sleep(pollMs);
    state = (await json(await fetchFn(`${API}/v2/${name}:fetchStatus`, { headers: auth }), "Status")).lastAsyncUploadState;
    log(`Upload: ${state}`);
  }
  if (state !== "SUCCEEDED") throw new Error(`Upload did not succeed: ${state} ${JSON.stringify(upload)}`);

  const published = await json(
    await fetchFn(`${API}/v2/${name}:publish`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
    }),
    "Publish",
  );
  for (const warning of published.warningInfo?.warnings ?? []) log(`Warning: ${warning.reason}: ${warning.description}`);
  log(`Submitted for review: ${published.state}`);
  return published.state;
}

/** Read-only: the item's published and submitted versions. */
export async function itemStatus(token: string, publisherId: string, itemId: string, fetchFn: Fetch = fetch) {
  const url = `${API}/v2/publishers/${publisherId}/items/${itemId}:fetchStatus`;
  const status = await json(await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } }), "Status");
  const describe = (rev: any) =>
    rev ? `${rev.state} (${(rev.distributionChannels ?? []).map((c: any) => c.crxVersion).join(", ") || "no version"})` : "none";
  return {
    published: describe(status.publishedItemRevisionStatus),
    submitted: describe(status.submittedItemRevisionStatus),
    takenDown: Boolean(status.takenDown),
    warned: Boolean(status.warned),
  };
}

if (import.meta.main) {
  const [arg] = process.argv.slice(2);
  const { CWS_SERVICE_ACCOUNT_JSON, CWS_PUBLISHER_ID, CWS_ITEM_ID } = process.env;
  if (!arg || !CWS_SERVICE_ACCOUNT_JSON || !CWS_PUBLISHER_ID || !CWS_ITEM_ID) {
    console.error("usage: CWS_SERVICE_ACCOUNT_JSON=… CWS_PUBLISHER_ID=… CWS_ITEM_ID=… bun run scripts/cws-publish.ts <zip | --status>");
    process.exit(2);
  }
  const token = await accessToken(JSON.parse(CWS_SERVICE_ACCOUNT_JSON));
  if (arg === "--status") {
    console.log(await itemStatus(token, CWS_PUBLISHER_ID, CWS_ITEM_ID));
  } else {
    await uploadAndPublish({ token, publisherId: CWS_PUBLISHER_ID, itemId: CWS_ITEM_ID, zip: Bun.file(arg) });
  }
}
