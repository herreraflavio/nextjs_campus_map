///src/app/api/upload/route.ts
import { randomUUID, timingSafeEqual } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { buildUploadReceipt } from "./uploadReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const CLOUDFRONT_DISTRIBUTION_ID =
  process.env.UPLOAD_CLOUDFRONT_DISTRIBUTION_ID;
const UGC_MEDIA_SERVICE_SECRET = process.env.UGC_MEDIA_SERVICE_SECRET;
const STORAGE_KEY_PATTERN = /^images\/[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/;

/**
 * Public base URL that fronts your bucket objects.
 * Example:
 *   UPLOAD_PUBLIC_BASE_URL=https://tiles.flavioherrera.com
 *
 * Final URL returned:
 *   https://tiles.flavioherrera.com/images/<filename>
 */
const UPLOAD_PUBLIC_BASE_URL =
  process.env.UPLOAD_PUBLIC_BASE_URL || "https://tiles.flavioherrera.com";

if (!AWS_REGION) {
  throw new Error("Missing AWS_REGION environment variable.");
}

if (!AWS_BUCKET_NAME) {
  throw new Error("Missing AWS_BUCKET_NAME environment variable.");
}

const s3Client = new S3Client({
  region: AWS_REGION,
});
const cloudFrontClient = new CloudFrontClient({ region: "us-east-1" });

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename || "").toLowerCase();
  const base = path.basename(filename || "upload", ext);

  const safeBase = base
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");

  return `${safeBase || "upload"}${safeExt || ""}`;
}

function buildPublicUrl(key: string): string {
  return `${UPLOAD_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;
}

function isAuthorizedServiceRequest(request: NextRequest): boolean {
  if (!UGC_MEDIA_SERVICE_SECRET) {
    return false;
  }

  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${UGC_MEDIA_SERVICE_SECRET}`);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: NextRequest) {
  if (!UGC_MEDIA_SERVICE_SECRET) {
    return NextResponse.json(
      { error: "Image ownership service is not configured." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();

    // Support either "file" or "image" so your frontend can use either key.
    const maybeFile = formData.get("file") ?? formData.get("image");

    if (!(maybeFile instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 },
      );
    }

    if (!maybeFile.type?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file must be an image." },
        { status: 400 },
      );
    }

    const bytes = await maybeFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = sanitizeFilename(maybeFile.name || "image");
    const uniqueFileName = `${Date.now()}-${randomUUID()}-${originalName}`;
    const key = `images/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: maybeFile.type,
      CacheControl: "public, max-age=31536000, immutable",
    });

    await s3Client.send(command);

    const imageUrl = buildPublicUrl(key);

    return NextResponse.json(
      {
        message: "Upload successful",
        url: imageUrl,
        key,
        receipt: buildUploadReceipt(key, UGC_MEDIA_SERVICE_SECRET),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error uploading to S3:", error);
    return NextResponse.json(
      { error: "Failed to upload image to S3" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!UGC_MEDIA_SERVICE_SECRET || !CLOUDFRONT_DISTRIBUTION_ID) {
    return NextResponse.json(
      { error: "Image deletion service is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedServiceRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const requestedKeys =
    typeof body === "object" && body !== null && "keys" in body
      ? (body as { keys?: unknown }).keys
      : null;

  if (
    !Array.isArray(requestedKeys) ||
    requestedKeys.length === 0 ||
    requestedKeys.length > 500 ||
    requestedKeys.some(
      (key) => typeof key !== "string" || !STORAGE_KEY_PATTERN.test(key),
    )
  ) {
    return NextResponse.json(
      { error: "keys must contain 1 to 500 valid image storage keys." },
      { status: 400 },
    );
  }

  const keys = [...new Set(requestedKeys as string[])];

  try {
    const deleteResult = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: AWS_BUCKET_NAME,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    if (deleteResult.Errors?.length) {
      console.error("S3 image deletion returned partial errors:", deleteResult.Errors);
      return NextResponse.json(
        { error: "Failed to delete one or more images from S3." },
        { status: 502 },
      );
    }

    const invalidation = await cloudFrontClient.send(
      new CreateInvalidationCommand({
        DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: `ugc-delete-${Date.now()}-${randomUUID()}`,
          Paths: {
            Items: keys.map((key) => `/${key}`),
            Quantity: keys.length,
          },
        },
      }),
    );

    const invalidationId = invalidation.Invalidation?.Id;

    if (!invalidationId) {
      throw new Error("CloudFront did not confirm the cache invalidation.");
    }

    return NextResponse.json({
      deleted_keys: keys,
      invalidation_id: invalidationId,
    });
  } catch (error) {
    console.error("Error deleting uploaded images:", error);
    return NextResponse.json(
      { error: "Failed to delete uploaded images." },
      { status: 502 },
    );
  }
}
