import { createHmac } from "crypto";

const RECEIPT_PREFIX = "v1.";

export function buildUploadReceipt(key: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(key)
    .digest("base64url");
  return `${RECEIPT_PREFIX}${signature}`;
}
