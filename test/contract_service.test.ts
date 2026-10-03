import assert from "node:assert/strict";
import { shouldSign } from "../src/contract_service.js";

const complete = { matter_id: "matter-42", pdf_base64: "JVBERi0x", cert_pem: "-----BEGIN CERTIFICATE-----", key_pem: "-----BEGIN PRIVATE KEY-----" };
assert.equal(shouldSign(complete), true);
assert.equal(shouldSign({ ...complete, cert_pem: "" }), false);
console.log("contract intake decision: complete material signs, incomplete material waits");
