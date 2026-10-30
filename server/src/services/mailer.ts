import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

// Development only (no SMTP configured): emails are printed to the server console and kept here.
export const outbox: Mail[] = [];

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transport = null;
    return transport;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true"; // true for port 465, false for 587 (STARTTLS)
  transport = nodemailer.createTransport({
    host,
    port,
    secure,
    // in production, never send on port 587 unless the connection upgrades to TLS
    requireTLS: !secure && process.env.NODE_ENV === "production",
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS ?? "").replace(/\s+/g, "") } // Gmail shows app passwords with spaces
      : undefined,
  });
  return transport;
}

export async function sendMail(mail: Mail) {
  const t = getTransport();
  if (!t) {
    outbox.push(mail);
    if (outbox.length > 20) outbox.shift();
    console.log(
      `\n--- email (dev: SMTP not configured) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n----------------------------------------\n`
    );
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM ?? "Owlet <no-reply@localhost>", ...mail });
}