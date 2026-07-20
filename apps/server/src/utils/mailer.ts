import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Mailer priority:
 * 1) Resend (RESEND_API_KEY)
 * 2) SMTP (SMTP_HOST)
 * 3) Dev console log
 */
let transporter: Transporter | null = null;
let resendClient: Resend | null = null;

const RESEND_TEST_FROM = 'Kushlov <onboarding@resend.dev>';

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function getTransport(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Strip wrapping quotes Vercel/env files sometimes keep. */
function sanitizeFrom(raw: string | undefined): string {
  const cleaned = (raw ?? '').trim().replace(/^["']|["']$/g, '').trim();
  return cleaned || RESEND_TEST_FROM;
}

function fromEmailAddress(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  return (angled?.[1] ?? from).trim().toLowerCase();
}

function isResendTestFrom(from: string): boolean {
  return fromEmailAddress(from).endsWith('@resend.dev');
}

/**
 * Resend rejects unverified domains (e.g. no-reply@kushlov.app).
 * Use the configured address only when it is @resend.dev or RESEND_DOMAIN_VERIFIED=true.
 */
function resolveResendFrom(): string {
  const configured = sanitizeFrom(env.MAIL_FROM);
  if (isResendTestFrom(configured)) return configured;
  if (env.RESEND_DOMAIN_VERIFIED === 'true') return configured;
  logger.warn(
    { configured },
    'MAIL_FROM domain is not verified on Resend — using onboarding@resend.dev',
  );
  return RESEND_TEST_FROM;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const resend = getResend();
  if (resend) {
    const from = resolveResendFrom();
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) {
      logger.error({ err: error, to: opts.to, from }, 'Resend email failed');
      const msg = error.message || 'Failed to send email';
      // Common free-tier / unverified-domain failures — surface actionable text.
      if (/domain|not verified|from/i.test(msg)) {
        throw new Error(
          'Email sender is not verified on Resend. Set MAIL_FROM to "Kushlov <onboarding@resend.dev>" or verify your domain.',
        );
      }
      if (/only send testing emails|own email/i.test(msg)) {
        throw new Error(
          'Resend test mode can only email your Resend account address until you verify a domain.',
        );
      }
      throw new Error(msg);
    }

    logger.info({ to: opts.to, subject: opts.subject, from }, '📧 Email sent via Resend');
    return;
  }

  const transport = getTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, '📧 [DEV] Email (no Resend/SMTP configured)');
    logger.debug({ html: opts.html }, 'Email body');
    return;
  }
  await transport.sendMail({ from: sanitizeFrom(env.MAIL_FROM), ...opts });
  logger.info({ to: opts.to, subject: opts.subject }, '📧 Email sent via SMTP');
}

export function passwordResetEmail(name: string, resetUrl: string) {
  const safeName = escapeHtml(name || 'there');
  return {
    subject: 'Reset your Kushlov password',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Hi ${safeName},</h2>
      <p style="line-height:1.5;color:#444">We received a request to reset your Kushlov password. This link expires in 30 minutes.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="background:#e11d74;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Reset password</a>
      </p>
      <p style="font-size:13px;color:#777;line-height:1.5">If the button doesn’t work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color:#e11d74;word-break:break-all">${resetUrl}</a>
      </p>
      <p style="font-size:13px;color:#777">If you didn’t request this, you can safely ignore this email.</p>
    </div>`,
    text: `Hi ${name || 'there'},\n\nReset your Kushlov password (expires in 30 minutes):\n${resetUrl}\n\nIf you didn’t request this, ignore this email.`,
  };
}
