import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html: string };

// Development only (no SMTP configured): emails are printed to the server console and kept here.
export const outbox: Mail[] = [];

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  transport = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587 (STARTTLS)
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
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