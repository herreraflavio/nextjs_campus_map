///src/app/api/upload/route.ts
import { randomUUID, timingSafeEqual } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const UGC_MEDIA_SERVICE_SECRET = process.env.UGC_MEDIA_SERVICE_SECRET;
const MAX_DELETE_KEYS = 500;
const VALID_IMAGE_KEY_PATTERN = /^images\/(?!\.{1,2}$)[A-Za-z0-9._-]+$/;

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

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function isAuthorizedServiceRequest(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (!authorization?.startsWith(bearerPrefix) || !UGC_MEDIA_SERVICE_SECRET) {
    return false;
  }

  const providedSecret = authorization.slice(bearerPrefix.length);
  return timingSafeStringEqual(providedSecret, UGC_MEDIA_SERVICE_SECRET);
}

function isValidImageKey(key: unknown): key is string {
  if (typeof key !== "string") {
    return false;
  }

  if (key.length === 0 || key.length > 1024) {
    return false;
  }

  if (key.startsWith("/") || key.includes("\\")) {
    return false;
  }

  return VALID_IMAGE_KEY_PATTERN.test(key);
}

export async function POST(request: NextRequest) {
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
  if (!UGC_MEDIA_SERVICE_SECRET) {
    return NextResponse.json(
      { error: "Media deletion service is not configured." },
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

  if (
    !body ||
    typeof body !== "object" ||
    !("keys" in body) ||
    !Array.isArray(body.keys)
  ) {
    return NextResponse.json(
      { error: "Request body must include a keys array." },
      { status: 400 },
    );
  }

  if (body.keys.length < 1 || body.keys.length > MAX_DELETE_KEYS) {
    return NextResponse.json(
      { error: `keys must contain between 1 and ${MAX_DELETE_KEYS} items.` },
      { status: 400 },
    );
  }

  const invalidKeys = body.keys.filter((key) => !isValidImageKey(key));

  if (invalidKeys.length > 0) {
    return NextResponse.json(
      {
        error: "All keys must be valid uploaded image storage keys.",
        invalid_keys: invalidKeys,
      },
      { status: 400 },
    );
  }

  const keys = Array.from(new Set(body.keys));

  try {
    const command = new DeleteObjectsCommand({
      Bucket: AWS_BUCKET_NAME,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
      },
    });

    const result = await s3Client.send(command);

    if (result.Errors && result.Errors.length > 0) {
      return NextResponse.json(
        {
          error: "One or more images could not be deleted.",
          deleted_keys: result.Deleted?.map(({ Key }) => Key).filter(Boolean),
          failed_keys: result.Errors.map(({ Key, Code, Message }) => ({
            key: Key,
            code: Code,
            message: Message,
          })),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ deleted_keys: keys }, { status: 200 });
  } catch (error) {
    console.error("Error deleting images from S3:", error);
    return NextResponse.json(
      { error: "Failed to delete images from S3" },
      { status: 500 },
    );
  }
}
