import { randomUUID, createHash } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;

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

/**
 * Toggle this in env if you want verbose error details returned in the API response.
 * Recommended while debugging, then turn off later.
 */
const DEBUG_UPLOADS = process.env.DEBUG_UPLOADS === "true";

if (!AWS_REGION) {
  throw new Error("Missing AWS_REGION environment variable.");
}

if (!AWS_BUCKET_NAME) {
  throw new Error("Missing AWS_BUCKET_NAME environment variable.");
}

const s3Client = new S3Client({
  region: AWS_REGION,
  maxAttempts: 3,
  logger: console,
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

function maskValue(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function safeEnvSnapshot() {
  return {
    hasAwsRegion: !!AWS_REGION,
    awsRegion: AWS_REGION ?? null,
    hasBucketName: !!AWS_BUCKET_NAME,
    bucketName: AWS_BUCKET_NAME ?? null,
    hasAccessKeyId: !!AWS_ACCESS_KEY_ID,
    accessKeyIdPreview: maskValue(AWS_ACCESS_KEY_ID),
    hasSecretAccessKey: !!AWS_SECRET_ACCESS_KEY,
    hasSessionToken: !!AWS_SESSION_TOKEN,
    uploadPublicBaseUrl: UPLOAD_PUBLIC_BASE_URL,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    awsExecutionEnv: process.env.AWS_EXECUTION_ENV ?? null,
  };
}

function getRequestSnapshot(request: NextRequest) {
  return {
    method: request.method,
    url: request.url,
    nextUrl: request.nextUrl?.toString?.() ?? null,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    userAgent: request.headers.get("user-agent"),
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
    xForwardedFor: request.headers.get("x-forwarded-for"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    xForwardedProto: request.headers.get("x-forwarded-proto"),
    cfConnectingIp: request.headers.get("cf-connecting-ip"),
    cfRay: request.headers.get("cf-ray"),
  };
}

function serializeUnknownError(error: unknown) {
  const e = error as
    | (Error & {
        code?: string;
        Code?: string;
        type?: string;
        Type?: string;
        cause?: unknown;
        fault?: string;
        $fault?: string;
        $metadata?: {
          httpStatusCode?: number;
          requestId?: string;
          extendedRequestId?: string;
          attempts?: number;
          totalRetryDelay?: number;
          cfId?: string;
        };
        BucketName?: string;
        Key?: string;
      })
    | undefined;

  const enumerable: Record<string, unknown> = {};
  if (error && typeof error === "object") {
    for (const [key, value] of Object.entries(
      error as Record<string, unknown>,
    )) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value == null
      ) {
        enumerable[key] = value;
      } else if (Array.isArray(value)) {
        enumerable[key] = value;
      } else if (key === "$metadata" && value && typeof value === "object") {
        enumerable[key] = value;
      }
    }
  }

  return {
    name: e?.name ?? null,
    message:
      e?.message ?? (typeof error === "string" ? error : "Unknown error"),
    stack: e?.stack ?? null,
    code: e?.code ?? e?.Code ?? null,
    type: e?.type ?? e?.Type ?? null,
    fault: e?.fault ?? e?.$fault ?? null,
    cause:
      e?.cause instanceof Error
        ? {
            name: e.cause.name,
            message: e.cause.message,
            stack: e.cause.stack ?? null,
          }
        : (e?.cause ?? null),
    metadata: e?.$metadata
      ? {
          httpStatusCode: e.$metadata.httpStatusCode ?? null,
          requestId: e.$metadata.requestId ?? null,
          extendedRequestId: e.$metadata.extendedRequestId ?? null,
          attempts: e.$metadata.attempts ?? null,
          totalRetryDelay: e.$metadata.totalRetryDelay ?? null,
          cfId: e.$metadata.cfId ?? null,
        }
      : null,
    bucketName: e?.BucketName ?? null,
    key: e?.Key ?? null,
    enumerable,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestSnapshot = getRequestSnapshot(request);

  console.log("[upload] request started", {
    startedAtIso: new Date(startedAt).toISOString(),
    request: requestSnapshot,
    env: safeEnvSnapshot(),
  });

  try {
    const formData = await request.formData();
    const formKeys = Array.from(formData.keys());

    console.log("[upload] parsed formData", {
      formKeys,
      request: requestSnapshot,
    });

    // Support either "file" or "image" so your frontend can use either key.
    const maybeFile = formData.get("file") ?? formData.get("image");

    if (!(maybeFile instanceof File)) {
      console.error("[upload] no valid File instance found", {
        receivedType:
          maybeFile === null
            ? "null"
            : maybeFile === undefined
              ? "undefined"
              : Object.prototype.toString.call(maybeFile),
        formKeys,
      });

      return NextResponse.json(
        {
          error: "No image file provided.",
          debug: DEBUG_UPLOADS
            ? {
                formKeys,
                receivedType:
                  maybeFile === null
                    ? "null"
                    : maybeFile === undefined
                      ? "undefined"
                      : Object.prototype.toString.call(maybeFile),
                request: requestSnapshot,
              }
            : undefined,
        },
        { status: 400 },
      );
    }

    const fileInfo = {
      name: maybeFile.name,
      type: maybeFile.type,
      size: maybeFile.size,
      lastModified: maybeFile.lastModified,
    };

    console.log("[upload] file received", fileInfo);

    if (!maybeFile.type?.startsWith("image/")) {
      console.error("[upload] invalid file type", fileInfo);

      return NextResponse.json(
        {
          error: "Uploaded file must be an image.",
          debug: DEBUG_UPLOADS
            ? { fileInfo, request: requestSnapshot }
            : undefined,
        },
        { status: 400 },
      );
    }

    const bytes = await maybeFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = sanitizeFilename(maybeFile.name || "image");
    const uniqueFileName = `${Date.now()}-${randomUUID()}-${originalName}`;
    const key = `images/${uniqueFileName}`;

    const fileHashSha256 = createHash("sha256").update(buffer).digest("hex");

    const uploadContext = {
      bucket: AWS_BUCKET_NAME,
      region: AWS_REGION,
      key,
      originalName: maybeFile.name,
      sanitizedName: originalName,
      contentType: maybeFile.type,
      sizeBytes: buffer.byteLength,
      sha256: fileHashSha256,
    };

    console.log("[upload] preparing S3 putObject", uploadContext);

    const command = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: maybeFile.type,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const s3Response = await s3Client.send(command);

    const imageUrl = buildPublicUrl(key);
    const durationMs = Date.now() - startedAt;

    console.log("[upload] upload successful", {
      durationMs,
      imageUrl,
      uploadContext,
      s3Response: {
        ETag: s3Response.ETag ?? null,
        VersionId: s3Response.VersionId ?? null,
        Expiration: s3Response.Expiration ?? null,
        ServerSideEncryption: s3Response.ServerSideEncryption ?? null,
        SSEKMSKeyId: s3Response.SSEKMSKeyId ?? null,
        BucketKeyEnabled: s3Response.BucketKeyEnabled ?? null,
        RequestCharged: s3Response.RequestCharged ?? null,
        metadata: s3Response.$metadata
          ? {
              httpStatusCode: s3Response.$metadata.httpStatusCode ?? null,
              requestId: s3Response.$metadata.requestId ?? null,
              extendedRequestId: s3Response.$metadata.extendedRequestId ?? null,
              attempts: s3Response.$metadata.attempts ?? null,
              totalRetryDelay: s3Response.$metadata.totalRetryDelay ?? null,
              cfId: s3Response.$metadata.cfId ?? null,
            }
          : null,
      },
    });

    return NextResponse.json(
      {
        message: "Upload successful",
        url: imageUrl,
        key,
        debug: DEBUG_UPLOADS
          ? {
              durationMs,
              uploadContext,
              s3Response: {
                ETag: s3Response.ETag ?? null,
                VersionId: s3Response.VersionId ?? null,
                Expiration: s3Response.Expiration ?? null,
                ServerSideEncryption: s3Response.ServerSideEncryption ?? null,
                SSEKMSKeyId: s3Response.SSEKMSKeyId ?? null,
                BucketKeyEnabled: s3Response.BucketKeyEnabled ?? null,
                RequestCharged: s3Response.RequestCharged ?? null,
                metadata: s3Response.$metadata
                  ? {
                      httpStatusCode:
                        s3Response.$metadata.httpStatusCode ?? null,
                      requestId: s3Response.$metadata.requestId ?? null,
                      extendedRequestId:
                        s3Response.$metadata.extendedRequestId ?? null,
                      attempts: s3Response.$metadata.attempts ?? null,
                      totalRetryDelay:
                        s3Response.$metadata.totalRetryDelay ?? null,
                      cfId: s3Response.$metadata.cfId ?? null,
                    }
                  : null,
              },
            }
          : undefined,
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const serializedError = serializeUnknownError(error);

    console.error("[upload] upload failed", {
      durationMs,
      request: requestSnapshot,
      env: safeEnvSnapshot(),
      error: serializedError,
    });

    return NextResponse.json(
      {
        error: "Failed to upload image to S3",
        debug: {
          durationMs,
          request: requestSnapshot,
          env: safeEnvSnapshot(),
          error: serializedError,
        },
      },
      { status: 500 },
    );
  }
}
