import { db } from "@/db";
import { CHAT_UPLOADS } from "@/db/collections";
import type { ChatUploadDoc } from "@/db/collections";
import { getSignedChatFileUrl } from "@/lib/storage/s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const isDownload = searchParams.get("download") === "1";
  const doc = await db.collection<ChatUploadDoc>(CHAT_UPLOADS).findOne(
    { id },
    {
      projection: {
        contentType: 1,
        data: 1,
        filename: 1,
        s3Bucket: 1,
        s3Key: 1,
        size: 1,
      },
    },
  );

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.s3Bucket && doc.s3Key) {
    const proxy = searchParams.get("proxy") === "1";
    if (proxy) {
      try {
        const signedUrl = await getSignedChatFileUrl({
          bucket: doc.s3Bucket,
          key: doc.s3Key,
          filename: doc.filename ?? null,
          contentType: doc.contentType ?? null,
          disposition: isDownload ? "attachment" : "inline",
        });
        const res = await fetch(signedUrl);
        if (!res.ok) {
          return NextResponse.json(
            { error: "Failed to fetch file from storage" },
            { status: 502 },
          );
        }
        const arrayBuffer = await res.arrayBuffer();
        return new NextResponse(arrayBuffer, {
          status: 200,
          headers: {
            "Content-Type":
              doc.contentType ||
              res.headers.get("content-type") ||
              "application/octet-stream",
            "Cache-Control": "private, max-age=60",
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to fetch file from storage" },
          { status: 502 },
        );
      }
    }
    try {
      const signedUrl = await getSignedChatFileUrl({
        bucket: doc.s3Bucket,
        key: doc.s3Key,
        filename: doc.filename ?? null,
        contentType: doc.contentType ?? null,
        disposition: isDownload ? "attachment" : "inline",
      });
      return NextResponse.redirect(signedUrl, 302);
    } catch {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 502 },
      );
    }
  }

  if (!doc.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.isBuffer(doc.data)
    ? doc.data
    : Buffer.from(doc.data as ArrayBuffer);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000",
      ...(doc.filename && {
        "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "%22")}"`,
      }),
    },
  });
}
