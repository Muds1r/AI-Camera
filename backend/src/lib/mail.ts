import { createHash, randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';

let transporter: Transporter | null = null;
let resendClient: Resend | null = null;

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim());
}

function getResend(): Resend {
  if (!resendConfigured()) {
    throw new Error('Resend is not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY!.trim());
  }
  return resendClient;
}

function getTransporter(): Transporter {
  if (!smtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = port === 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS ?? '',
      },
    });
  }
  return transporter;
}

function appName(): string {
  return process.env.APP_NAME?.trim() || 'TruckFlow';
}

function defaultFrom(): string {
  const from = process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim();
  if (from) return from;
  return `${appName()} <onboarding@resend.dev>`;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function resendErrorStatus(error: { name?: string; message?: string }): number | null {
  const status = (error as { statusCode?: number }).statusCode;
  if (typeof status === 'number') return status;
  const match = error.message?.match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendViaResend(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}): Promise<void> {
  const resend = getResend();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await resend.emails.send(
      {
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (!error) {
      console.info(`[mail:resend] Sent password reset (id=${data?.id})`);
      return;
    }

    const status = resendErrorStatus(error);
    if (status !== null && !RETRYABLE_STATUS.has(status)) {
      throw new Error(error.message ?? 'Resend rejected the send');
    }

    if (attempt === maxAttempts - 1) {
      throw new Error(error.message ?? 'Resend send failed after retries');
    }

    const backoffMs = status === 429 ? 2000 : 500 * 2 ** attempt;
    await sleep(backoffMs);
  }
}

export type PasswordResetEmail = {
  to: string;
  loginEmail: string;
  newPassword: string;
  idempotencyKey?: string;
};

export async function sendPasswordResetEmail(input: PasswordResetEmail): Promise<void> {
  const from = defaultFrom();
  const subject = `${appName()} — your new password`;
  const text = [
    `Hello,`,
    ``,
    `A new password was requested for ${appName()}.`,
    ``,
    `Company email: ${input.loginEmail}`,
    `New password: ${input.newPassword}`,
    ``,
    `Sign in and change this password from your profile when you can.`,
    ``,
    `If you did not request this, contact your HR administrator.`,
  ].join('\n');

  if (!resendConfigured() && !smtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'RESEND_API_KEY or SMTP must be configured in production to send password reset email',
      );
    }
    console.info(
      `[mail:dev] Password reset for ${input.loginEmail} → ${input.to}\n` +
        `New password: ${input.newPassword}`,
    );
    return;
  }

  const idempotencyKey =
    input.idempotencyKey ??
    `password-reset/${createHash('sha256').update(`${input.loginEmail}:${input.to}:${randomUUID()}`).digest('hex').slice(0, 32)}`;

  if (resendConfigured()) {
    await sendViaResend({ from, to: input.to, subject, text, idempotencyKey });
    return;
  }

  await getTransporter().sendMail({
    from,
    to: input.to,
    subject,
    text,
  });
}

export function isMailConfigured(): boolean {
  return resendConfigured() || smtpConfigured();
}
