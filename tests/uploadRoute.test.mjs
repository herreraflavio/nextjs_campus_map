import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";

process.env.AWS_REGION = "us-west-2";
process.env.AWS_BUCKET_NAME = "test-bucket";
process.env.UPLOAD_PUBLIC_BASE_URL = "https://cdn.example.test";
process.env.UPLOAD_CLOUDFRONT_DISTRIBUTION_ID = "TESTDISTRIBUTION";
process.env.UGC_MEDIA_SERVICE_SECRET =
  "test-wildlife-image-service-secret-long-enough";

const { NextRequest } = await import("next/server");
const { CloudFrontClient, CreateInvalidationCommand } = await import(
  "@aws-sdk/client-cloudfront"
);
const { DeleteObjectsCommand, PutObjectCommand, S3Client } = await import(
  "@aws-sdk/client-s3"
);
const { buildUploadReceipt } = await import(
  "../src/app/api/upload/uploadReceipt.ts"
);
const { DELETE, POST } = await import(
  "../src/app/api/upload/route.ts"
);

const originalS3Send = S3Client.prototype.send;
const originalCloudFrontSend = CloudFrontClient.prototype.send;

afterEach(() => {
  S3Client.prototype.send = originalS3Send;
  CloudFrontClient.prototype.send = originalCloudFrontSend;
});

test("upload receipts use the Node-compatible HMAC format", () => {
  const key = "images/1788044937588-owned-wildlife.jpg";
  const signature = createHmac(
    "sha256",
    process.env.UGC_MEDIA_SERVICE_SECRET,
  )
    .update(key)
    .digest("base64url");

  assert.equal(
    buildUploadReceipt(key, process.env.UGC_MEDIA_SERVICE_SECRET),
    `v1.${signature}`,
  );
});

test("image upload stores the S3 object and returns owned storage metadata", async () => {
  const commands = [];
  S3Client.prototype.send = async (command) => {
    commands.push(command);
    return {};
  };

  const formData = new FormData();
  formData.set(
    "image",
    new File(["image-bytes"], "rabbit.jpg", { type: "image/jpeg" }),
  );
  const response = await POST(
    new NextRequest("https://mapbuilder.example/api/upload", {
      method: "POST",
      body: formData,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.Bucket, process.env.AWS_BUCKET_NAME);
  assert.match(body.key, /^images\/.*-rabbit\.jpg$/);
  assert.equal(body.url, `https://cdn.example.test/${body.key}`);
  assert.equal(
    body.receipt,
    buildUploadReceipt(body.key, process.env.UGC_MEDIA_SERVICE_SECRET),
  );
});

test("image deletion rejects public requests before contacting AWS", async () => {
  const response = await DELETE(
    new NextRequest("https://mapbuilder.example/api/upload", {
      method: "DELETE",
      body: JSON.stringify({ keys: ["images/owned-wildlife.jpg"] }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.equal(response.status, 401);
});

test("image deletion rejects unsafe storage keys before contacting AWS", async () => {
  const response = await DELETE(
    new NextRequest("https://mapbuilder.example/api/upload", {
      method: "DELETE",
      body: JSON.stringify({ keys: ["images/../unrelated.jpg"] }),
      headers: {
        Authorization: `Bearer ${process.env.UGC_MEDIA_SERVICE_SECRET}`,
        "Content-Type": "application/json",
      },
    }),
  );

  assert.equal(response.status, 400);
});

test("authenticated deletion removes S3 objects and invalidates cached URLs", async () => {
  const key = "images/owned-wildlife.jpg";
  const commands = [];
  S3Client.prototype.send = async (command) => {
    commands.push(command);
    return {};
  };
  CloudFrontClient.prototype.send = async (command) => {
    commands.push(command);
    return { Invalidation: { Id: "TESTINVALIDATION" } };
  };

  const response = await DELETE(
    new NextRequest("https://mapbuilder.example/api/upload", {
      method: "DELETE",
      body: JSON.stringify({ keys: [key] }),
      headers: {
        Authorization: `Bearer ${process.env.UGC_MEDIA_SERVICE_SECRET}`,
        "Content-Type": "application/json",
      },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    deleted_keys: [key],
    invalidation_id: "TESTINVALIDATION",
  });
  assert.ok(commands[0] instanceof DeleteObjectsCommand);
  assert.deepEqual(commands[0].input.Delete.Objects, [{ Key: key }]);
  assert.ok(commands[1] instanceof CreateInvalidationCommand);
  assert.deepEqual(commands[1].input.InvalidationBatch.Paths.Items, [`/${key}`]);
});
