import { describe, expect, test } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { accessToken, tokenAssertion, uploadAndPublish } from "../scripts/cws-publish";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  client_email: "publisher@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

test("the token assertion is a valid RS256 JWT for the Chrome Web Store scope", () => {
  const jwt = tokenAssertion(account, 1_000);
  const [header, claims, signature] = jwt.split(".");
  expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
  expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toEqual({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/chromewebstore",
    aud: "https://oauth2.googleapis.com/token",
    iat: 1_000,
    exp: 4_600,
  });
  const valid = createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature!, "base64url"));
  expect(valid).toBe(true);
});

/** Replays canned responses and records the requests. */
function fakeFetch(responses: Array<[number, unknown]>) {
  const requests: Array<{ url: string; method: string }> = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    const [status, body] = responses.shift()!;
    return new Response(JSON.stringify(body), { status });
  };
  return { fetchFn, requests };
}

test("accessToken exchanges the assertion", async () => {
  const { fetchFn, requests } = fakeFetch([[200, { access_token: "ya29.token" }]]);
  expect(await accessToken(account, fetchFn)).toBe("ya29.token");
  expect(requests).toEqual([{ url: "https://oauth2.googleapis.com/token", method: "POST" }]);
});

describe("uploadAndPublish", () => {
  const base = { token: "t", publisherId: "pub", itemId: "item", zip: new Blob(["zip"]), pollMs: 0, log: () => {} };
  const item = "https://chromewebstore.googleapis.com/v2/publishers/pub/items/item";

  test("waits for an async upload, then submits for review", async () => {
    const { fetchFn, requests } = fakeFetch([
      [200, { uploadState: "UPLOAD_IN_PROGRESS" }],
      [200, { lastAsyncUploadState: "UPLOAD_IN_PROGRESS" }],
      [200, { lastAsyncUploadState: "SUCCEEDED" }],
      [200, { state: "PENDING_REVIEW" }],
    ]);
    expect(await uploadAndPublish({ ...base, fetchFn })).toBe("PENDING_REVIEW");
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      "POST https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/item:upload",
      `GET ${item}:fetchStatus`,
      `GET ${item}:fetchStatus`,
      `POST ${item}:publish`,
    ]);
  });

  test("a failed upload is never published", async () => {
    const { fetchFn, requests } = fakeFetch([[200, { uploadState: "FAILED" }]]);
    await expect(uploadAndPublish({ ...base, fetchFn })).rejects.toThrow("Upload did not succeed: FAILED");
    expect(requests).toHaveLength(1);
  });

  test("API errors surface with their body", async () => {
    const { fetchFn } = fakeFetch([[400, { error: { message: "version must be greater" } }]]);
    await expect(uploadAndPublish({ ...base, fetchFn })).rejects.toThrow("version must be greater");
  });
});
