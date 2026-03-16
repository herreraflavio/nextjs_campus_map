import { randomUUID } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;

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
