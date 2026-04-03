import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import {
  getBookingTemplates,
  updateBookingTemplates,
} from "@/lib/booking-templates";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const templates = await getBookingTemplates();
  return NextResponse.json(templates);
}

export async function PUT(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as {
    bookingConfirmationBody?: string;
    bookingReminderBody?: string;
    bookingReviewBody?: string;
  };

  const updates: typeof data = {};

  if (data.bookingConfirmationBody !== undefined) {
    if (
      typeof data.bookingConfirmationBody !== "string" ||
      !data.bookingConfirmationBody.trim()
    ) {
      return NextResponse.json(
        { error: "bookingConfirmationBody must be a non-empty string" },
        { status: 400 },
      );
    }
    updates.bookingConfirmationBody = data.bookingConfirmationBody.trim();
  }

  if (data.bookingReminderBody !== undefined) {
    if (
      typeof data.bookingReminderBody !== "string" ||
      !data.bookingReminderBody.trim()
    ) {
      return NextResponse.json(
        { error: "bookingReminderBody must be a non-empty string" },
        { status: 400 },
      );
    }
    updates.bookingReminderBody = data.bookingReminderBody.trim();
  }

  if (data.bookingReviewBody !== undefined) {
    if (
      typeof data.bookingReviewBody !== "string" ||
      !data.bookingReviewBody.trim()
    ) {
      return NextResponse.json(
        { error: "bookingReviewBody must be a non-empty string" },
        { status: 400 },
      );
    }
    updates.bookingReviewBody = data.bookingReviewBody.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "At least one template field must be provided" },
      { status: 400 },
    );
  }

  const saved = await updateBookingTemplates(updates, session.user.id);
  return NextResponse.json(saved);
}

