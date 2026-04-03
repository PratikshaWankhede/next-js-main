import { db } from "@/db";
import { CHAT_UPLOADS } from "@/db/collections";
import type { ChatUploadDoc } from "@/db/collections";
import { uploadChatFile } from "@/lib/storage/s3";
import { requireAuth } from "@/lib/rbac";
import { getSessionWithRole } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
];

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Use image, video, or PDF." },
      { status: 400 },
    );
  }

  const id = generateRandomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

  let uploaded;
  try {
    uploaded = await uploadChatFile({
      buffer,
      contentType: file.type,
      filename: file.name || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to upload file to storage" },
      { status: 502 },
    );
  }

  const doc: ChatUploadDoc = {
    id,
    contentType: file.type,
    filename: file.name || null,
    createdAt: new Date(),
    s3Bucket: uploaded.bucket,
    s3Key: uploaded.key,
    size: uploaded.size,
  };
  await db.collection<ChatUploadDoc>(CHAT_UPLOADS).insertOne(doc);

  const url = `/api/uploads/${id}`;

  return NextResponse.json({ id, url });
}
