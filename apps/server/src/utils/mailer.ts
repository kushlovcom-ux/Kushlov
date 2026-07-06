import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Mailer with graceful degradation: if SMTP is not configured we log the email
 * to the console (useful in dev), otherwise we send via the configured SMTP host.
 */
let transporter: Transporter | null = null;

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
  const transport = getTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, '📧 [DEV] Email (SMTP not configured)');
    logger.debug({ html: opts.html }, 'Email body');
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...opts });
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: 'Reset your Kushlov password',
    html: `<div style="font-family:sans-serif">
      <h2>Hi ${name},</h2>
      <p>We received a request to reset your password. This link expires in 30 minutes.</p>
      <p><a href="${resetUrl}" style="background:#e11d74;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>`,
    text: `Reset your password: ${resetUrl}`,
  };
}
