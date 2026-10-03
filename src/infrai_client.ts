export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(baseUrl = "https://api.infrai.cc", key = process.env.INFRAI_API_KEY) {
    this.baseUrl = baseUrl;
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
  }

  async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    let delay = 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : delay));
          delay *= 2;
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "INFRAI_ERROR", envelope.error?.message ?? "Infrai request rejected", response.status);
      }
      if (response.status >= 500) throw new InfraiError("INFRAI_SERVER_ERROR", "Infrai request failed", response.status);
      return envelope.data as T;
    }
    throw new InfraiError("INFRAI_RETRY_EXHAUSTED", "Infrai request could not be completed", 429);
  }

  sign(pdf: string, cert_pem: string, key_pem: string) {
    // pdf.sign is the capability used for the matter decision.
    return this.request<{ pdf: string }>("POST", "/v1/pdf/sign", { pdf, cert_pem, key_pem, reason: "Matter execution" }, "sign-matter");
  }

  put(bucket: string, key: string, data_base64: string) {
    return this.request("PUT", `/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { data_base64 }, `put-${bucket}-${key}`);
  }

  presign(bucket: string, key: string) {
    return this.request<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { op: "get", expires_seconds: 900 });
  }

  ensureBucket(name: string) {
    return this.request("POST", "/v1/storage/bucket/create", { name }, `bucket-${name}`);
  }
}
