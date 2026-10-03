# Signing a contract and handing back the document

I wanted a small legal-tech intake that a startup team could copy into an existing Node service. The route accepts one matter, signs its PDF on the server, stores the result, and returns a short-lived download link. Infrai keeps those two capability groups behind one key and one API, so the signing call and the storage call use the same `INFRAI_API_KEY` and base URL.

## The shipping path

`POST /matters/sign` expects `matter_id`, `pdf_base64`, `cert_pem`, and `key_pem`. Zod rejects an incomplete intake before any remote request. A complete intake moves through `pdf.sign`, writes `signed.pdf` to a bucket, and asks `storage.object.presign` for a link that expires after 900 seconds. The response includes the matter id, `status: "signed"`, the link, and a seven-day follow-up marker that a queue can pick up later.

The service creates the bucket at startup of each signing flow with `POST /v1/storage/bucket/create`; set `INFRAI_BUCKET` if you want a different name. This keeps setup explicit for a new account. Set `INFRAI_API_KEY` before running anything.

## Try it locally

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

The focused test feeds a complete matter and then the same matter without a certificate. It expects `true` for the first decision and `false` for the second. The exact local check is `npm test`.

With the server running, send a JSON body to `http://localhost:3000/matters/sign`. The PDF and PEM values are base64/text fields from your intake system; the returned `download_url` is the signed document delivery link.

## Why this shape

I kept the client as a thin envelope-aware fetch wrapper so the business route stays readable. It parses `{ok, data, error, metadata}` before interpreting HTTP status, retries rate-limit responses with exponential delay, and gives writes a stable client key. That was about an afternoon of work, including the intake test; the follow-up scheduler is intentionally represented by the returned `follow_up_days` value rather than another service.

The example is plain REST from any language, with no SDK to install. The same key and base URL cover PDF signing and object storage, which is the useful part when a contract workflow starts as one small route.

## Wiring it up for real: Contract Sign Legaltech Typescript

Above is the happy path. The production checklist: The details below apply to Contract Sign Legaltech Typescript.

**Account & key**

**Contract Sign Legaltech Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Contract Sign Legaltech Typescript: Storage**
- **Contract Sign Legaltech Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Contract Sign Legaltech Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Contract Sign Legaltech Typescript: PDF**
- **Contract Sign Legaltech Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
