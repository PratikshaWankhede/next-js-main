import { db } from "@/db";
import { LEAD_COMMENTS, LEADS } from "@/db/collections";
import type { LeadCommentDoc, LeadDoc } from "@/db/collections";
import { appendLeadTimelineEvent } from "@/lib/lead-timeline";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id, commentId } = await params;
  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await db
    .collection<LeadCommentDoc>(LEAD_COMMENTS)
    .findOne({ id: commentId, leadId: id });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.createdByUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the comment author can edit this comment" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const content =
    typeof payload.content === "string" ? payload.content.trim() : "";

  if (!content) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 },
    );
  }

  if (content.length > 8000) {
    return NextResponse.json(
      { error: "Comment must be at most 8000 characters" },
      { status: 400 },
    );
  }

  const updatedAt = new Date();
  await db.collection<LeadCommentDoc>(LEAD_COMMENTS).updateOne(
    { id: commentId, leadId: id },
    {
      $set: {
        content,
        updatedAt,
      },
    },
  );

  await appendLeadTimelineEvent(
    id,
    "comment_edited",
    { commentId, preview: content.slice(0, 120) },
    session.user.id,
  );

  return NextResponse.json({
    ...comment,
    content,
    updatedAt,
  });
}
