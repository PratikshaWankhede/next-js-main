import crypto from "crypto";

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

type UploadChatFileArgs = {
  buffer: Buffer;
  contentType: string;
  filename?: string | null;
};

export type UploadedChatFile = {
  bucket: string;
  key: string;
  size: number;
};

function getS3Config(): S3Config {
  const {
    S3_BUCKET_CHAT_UPLOADS,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_ENDPOINT,
  } = process.env;

  if (
    !S3_BUCKET_CHAT_UPLOADS ||
    !S3_REGION ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "[S3] Missing required environment variables. Please set S3_BUCKET_CHAT_UPLOADS, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return {
    bucket: S3_BUCKET_CHAT_UPLOADS,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    endpoint: S3_ENDPOINT,
  };
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function buildHost(config: S3Config): string {
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    return url.host;
  }
  return `${config.bucket}.s3.${config.region}.amazonaws.com`;
}

function buildBaseUrl(config: S3Config): string {
  if (config.endpoint) {
    const base = config.endpoint.endsWith("/")
      ? config.endpoint.slice(0, -1)
      : config.endpoint;
    return `${base}/${encodeURIComponent(config.bucket)}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
}

function encodeS3KeyForPath(key: string): string {
  return key
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!*'()]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

function buildObjectKey(filename?: string | null): string {
  const ts = Date.now();
  const safeName =
    typeof filename === "string" && filename.length > 0
      ? filename.replace(/[^a-zA-Z0-9._-]/g, "_")
      : "upload";
  // Flat structure inside a single logical folder, no nested year/month/day
  return `chat-uploads/${ts}-${safeName}`;
}

export async function uploadChatFile(
  args: UploadChatFileArgs,
): Promise<UploadedChatFile> {
  const config = getS3Config();
  const { buffer, contentType, filename } = args;

  const key = buildObjectKey(filename);
  const method = "PUT";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const host = buildHost(config);
  const path = `/${encodeS3KeyForPath(key)}`;

  const payloadHash = sha256Hex(buffer);
  const canonicalHeaders = `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${method}\n` +
    `${path}\n` +
    `\n` +
    canonicalHeaders +
    `\n` +
    signedHeaders +
    `\n` +
    payloadHash;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    sha256Hex(canonicalRequest);

  const signingKey = getSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    service,
  );
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const url =
    config.endpoint != null
      ? `${buildBaseUrl(config)}/${encodeURIComponent(key)}`
      : `https://${host}${path}`;

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
    // Buffer is supported at runtime in the Node.js environment, but the
    // Fetch typings for the Edge runtime do not include it, so we cast here.
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[S3] Upload failed with status ${res.status} ${res.statusText}: ${text}`,
    );
  }

  return {
    bucket: config.bucket,
    key,
    size: buffer.length,
  };
}

export function getS3ObjectUrl(params: {
  bucket: string;
  key: string;
  region?: string;
  endpoint?: string;
}): string {
  const { bucket, key, region, endpoint } = params;
  if (endpoint) {
    const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    return `${base}/${encodeURIComponent(bucket)}/${encodeS3KeyForPath(key)}`;
  }
  const finalRegion = region ?? process.env.S3_REGION;
  if (!finalRegion) {
    throw new Error(
      "[S3] Missing region for object URL. Set S3_REGION or pass region explicitly.",
    );
  }
  return `https://${bucket}.s3.${finalRegion}.amazonaws.com/${encodeS3KeyForPath(
    key,
  )}`;
}

export async function getSignedChatFileUrl(params: {
  bucket: string;
  key: string;
  filename?: string | null;
  contentType?: string | null;
  disposition?: "inline" | "attachment";
  expiresInSeconds?: number;
}): Promise<string> {
  const config = getS3Config();
  const {
    bucket,
    key,
    filename,
    contentType,
    disposition = "inline",
    expiresInSeconds = 900,
  } = params;

  const method = "GET";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const host = buildHost(config);
  const path = `/${encodeS3KeyForPath(key)}`;
  const payloadHash = "UNSIGNED-PAYLOAD";

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const baseQueryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const extraQueryEntries: Array<[string, string]> = [];

  if (filename || disposition) {
    const parts: string[] = [];
    parts.push(disposition === "attachment" ? "attachment" : "inline");
    if (filename) {
      parts.push(`filename="${filename}"`);
    }
    extraQueryEntries.push([
      "response-content-disposition",
      parts.join("; "),
    ]);
  }
  if (contentType) {
    extraQueryEntries.push(["response-content-type", contentType]);
  }

  const allQueryEntries = [...baseQueryEntries, ...extraQueryEntries];

  const canonicalQuerystring = allQueryEntries
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
    )
    .sort()
    .join("&");
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";

  const canonicalRequest =
    `${method}\n` +
    `${path}\n` +
    `${canonicalQuerystring}\n` +
    canonicalHeaders +
    `\n` +
    signedHeaders +
    `\n` +
    payloadHash;

  const stringToSign =
    "AWS4-HMAC-SHA256\n" +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    sha256Hex(canonicalRequest);

  const signingKey = getSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    service,
  );
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const finalQuery = new URLSearchParams();
  for (const [k, v] of allQueryEntries) {
    finalQuery.set(k, v);
  }
  finalQuery.set("X-Amz-Signature", signature);

  const baseUrl =
    config.endpoint != null
      ? `${buildBaseUrl(config)}/${encodeURIComponent(key)}`
      : `https://${host}${path}`;

  return `${baseUrl}?${finalQuery.toString()}`;
}

