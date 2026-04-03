import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import { db } from "@/db";
import { NOTIFICATION_PREFERENCES } from "@/db/collections";
import type { NotificationType } from "@/db/collections";

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  leadId: string | null;
};

type User = {
  id: string;
  email: string;
};

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !portRaw || !user || !pass) {
    console.error(
      "[email] SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
    );
    return null;
  }

  const port = Number(portRaw) || 587;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailLayout(opts: {
  title: string;
  preheader?: string;
  heading: string;
  bodyHtml: string;
}): string {
  const { title, preheader, heading, bodyHtml } = opts;
  const safeTitle = escapeHtml(title || "RJ Tattoo Studio CRM");
  const safePreheader = preheader ? escapeHtml(preheader) : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    ${
      safePreheader
        ? `<span style="display:none !important; color:transparent; max-height:0; max-width:0; opacity:0; overflow:hidden; visibility:hidden;">${safePreheader}</span>`
        : ""
    }
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f5; padding:24px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:20px 24px; background:linear-gradient(135deg,#0f172a,#020617); color:#e5e7eb;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="font-size:20px; font-weight:700; color:#f97316; white-space:nowrap;">
                      RJ Tattoo Studio
                    </td>
                    <td align="right" style="font-size:12px; color:#9ca3af; white-space:nowrap;">
                      CRM Notifications
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <h1 style="margin:0 0 12px 0; font-size:20px; line-height:1.3; color:#111827;">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px; font-size:14px; line-height:1.6; color:#374151;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 20px 24px; border-top:1px solid #e5e7eb; background-color:#f9fafb; font-size:12px; line-height:1.5; color:#6b7280;">
                <div style="margin-bottom:4px;">
                  This email was sent by <strong>RJ Tattoo Studio CRM</strong>.
                </div>
                <div>
                  If you did not expect this message, you can ignore this email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const transporter = getSmtpTransporter();
  if (!transporter) return false;

  const from =
    process.env.SMTP_FROM ?? "RJ Tattoo Studio <contact@rjtattoostudio.com>";

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? opts.text.replace(/\n/g, "<br />"),
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}

export async function sendEmailNotification(
  notification: Notification,
  user: User,
): Promise<boolean> {
  const pref = await db.collection(NOTIFICATION_PREFERENCES).findOne({
    userId: user.id,
    channel: "email",
    type: notification.type as NotificationType,
  });

  if (!pref || !pref.enabled) return false;

  const subject = notification.title || "New notification";
  const rawBody = notification.body || "";
  const text = rawBody;

  const bodyHtml = `<p>${escapeHtml(rawBody).replace(/\r\n|\r|\n/g, "<br />")}</p>`;

  const html = renderEmailLayout({
    title: subject,
    preheader: rawBody.slice(0, 80),
    heading: subject,
    bodyHtml,
  });

  return sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });
}

export async function sendUserWelcomeEmail(params: {
  name: string;
  email: string;
  password: string;
}): Promise<boolean> {
  const { name, email, password } = params;
  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  const loginUrl = `${baseUrl}/sign-in`;

  const subject = "RJ Tattoo Studio CRM – Your Account Details";

  const textLines = [
    `Hi ${name || "there"},`,
    "",
    "Your RJ Tattoo Studio CRM account has been created.",
    "",
    `Login URL: ${loginUrl}`,
    `Email: ${email}`,
    `Password: ${password}`,
    "",
    "For security, you can change your password from your account settings after logging in.",
    "",
    "Best regards,",
    "RJ Tattoo Studio",
  ];

  const text = textLines.join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name || "there")},</p>`,
    '<p style="margin:0 0 12px 0;">Your <strong>RJ Tattoo Studio CRM</strong> account has been created.</p>',
    '<p style="margin:0 0 8px 0;">Login details:</p>',
    `<p style="margin:0 0 12px 0;"><strong>Login URL:</strong> <a href="${escapeHtml(loginUrl)}" style="color:#ea580c; text-decoration:none;">${escapeHtml(loginUrl)}</a><br />`,
    `<strong>Email:</strong> ${escapeHtml(email)}<br />`,
    `<strong>Password:</strong> ${escapeHtml(password)}</p>`,
    '<p style="margin:12px 0 12px 0;">For security, you can change your password from your account settings after logging in.</p>',
    '<p style="margin:0;">Best regards,<br />RJ Tattoo Studio</p>',
  ].join("");

  const html = renderEmailLayout({
    title: subject,
    preheader: "Your RJ Tattoo Studio CRM account has been created.",
    heading: "Your RJ Tattoo Studio CRM account is ready",
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetOtpEmail(params: {
  email: string;
  otp: string;
}): Promise<boolean> {
  const { email, otp } = params;

  const subject = "RJ Tattoo Studio CRM – Password Reset Code";

  const textLines = [
    "We received a request to reset your RJ Tattoo Studio CRM password.",
    "",
    `Your one-time verification code is: ${otp}`,
    "",
    "This code is valid for 10 minutes.",
    "",
    "If you did not request this, you can safely ignore this email.",
  ];

  const text = textLines.join("\n");

  const bodyHtml = [
    '<p style="margin:0 0 12px 0;">We received a request to reset your <strong>RJ Tattoo Studio CRM</strong> password.</p>',
    `<p style="margin:0 0 12px 0;">Your one-time verification code is:</p>`,
    `<p style="margin:0 0 16px 0; font-size:20px; letter-spacing:0.35em; font-weight:700; color:#111827; text-align:center;">${escapeHtml(
      otp,
    )}</p>`,
    '<p style="margin:0 0 8px 0;">This code is valid for 10 minutes.</p>',
    '<p style="margin:0;">If you did not request this, you can safely ignore this email.</p>',
  ].join("");

  const html = renderEmailLayout({
    title: subject,
    preheader: "Your RJ Tattoo Studio CRM password reset code.",
    heading: "Password reset verification code",
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}
