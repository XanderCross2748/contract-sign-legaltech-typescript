import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

const Intake = z.object({ matter_id: z.string().min(1), pdf_base64: z.string().min(1), cert_pem: z.string().min(1), key_pem: z.string().min(1) });
export type Intake = z.infer<typeof Intake>;

export function shouldSign(input: Intake): boolean { return input.pdf_base64.length > 0 && input.cert_pem.includes("BEGIN CERTIFICATE") && input.key_pem.includes("BEGIN"); }

export async function signMatter(input: Intake, client = new InfraiClient()) {
  if (!shouldSign(input)) throw new Error("Matter intake is missing signing material");
  const signed = await client.sign(input.pdf_base64, input.cert_pem, input.key_pem);
  const bucket = process.env.INFRAI_BUCKET ?? "legal-matters";
  await client.ensureBucket(bucket);
  const objectKey = `${input.matter_id}/signed.pdf`;
  await client.put(bucket, objectKey, signed.pdf);
  const link = await client.presign(bucket, objectKey);
  return { matter_id: input.matter_id, status: "signed", download_url: link.url, follow_up_days: 7 };
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/matters/sign") { response.writeHead(404); response.end(); return; }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = Intake.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await signMatter(input);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request rejected" }));
  }
});

if (process.argv[1]?.endsWith("contract_service.ts")) server.listen(Number(process.env.PORT ?? 3000));
