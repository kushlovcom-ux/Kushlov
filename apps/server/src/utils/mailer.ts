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

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: env.MAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      logger.error({ err: error, to: opts.to }, 'Resend email failed');
      throw new Error(error.message || 'Failed to send email');
    }
    logger.info({ to: opts.to, subject: opts.subject }, '📧 Email sent via Resend');
    return;
  }

  const transport = getTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, '📧 [DEV] Email (no Resend/SMTP configured)');
    logger.debug({ html: opts.html }, 'Email body');
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...opts });
  logger.info({ to: opts.to, subject: opts.subject }, '📧 Email sent via SMTP');
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: 'Reset your Kushlov password',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Hi ${name},</h2>
      <p style="line-height:1.5;color:#444">We received a request to reset your Kushlov password. This link expires in 30 minutes.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="background:#e11d74;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Reset password</a>
      </p>
      <p style="font-size:13px;color:#777;line-height:1.5">If the button doesn’t work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color:#e11d74;word-break:break-all">${resetUrl}</a>
      </p>
      <p style="font-size:13px;color:#777">If you didn’t request this, you can safely ignore this email.</p>
    </div>`,
    text: `Hi ${name},\n\nReset your Kushlov password (expires in 30 minutes):\n${resetUrl}\n\nIf you didn’t request this, ignore this email.`,
  };
}
