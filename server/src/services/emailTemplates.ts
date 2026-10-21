import type { Mail } from "./mailer.js";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const clientUrl = () => (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/+$/, "");

function layout(opts: { title: string; intro: string; button?: { label: string; url: string }; note: string }) {
  const btn = opts.button
    ? `<p style="margin:24px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#102b5c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">${esc(opts.button.label)}</a></p>
       <p style="margin:0 0 18px;font-size:12px;color:#64748b">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${esc(opts.button.url)}</span></p>`
    : "";
  return `<div style="background:#f5f7fb;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
    <div style="font-size:18px;font-weight:700;color:#0a234d">Owlet</div>
    <h1 style="margin:18px 0 8px;font-size:20px;color:#0a234d">${esc(opts.title)}</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${esc(opts.intro)}</p>
    ${btn}
    <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8">${esc(opts.note)}</p>
  </div></div>`;
}

export function verifyEmail(to: string, token: string): Mail {
  const url = `${clientUrl()}/verify-email?token=${token}`;
  const intro = "Welcome to Owlet! Confirm your email address to finish creating your account.";
  const note = "This link expires in 24 hours. If you didn't sign up for Owlet, you can ignore this email.";
  return {
    to,
    subject: "Confirm your Owlet email",
    text: `${intro}\n\nConfirm your email: ${url}\n\n${note}`,
    html: layout({ title: "Confirm your email", intro, button: { label: "Confirm email", url }, note }),
  };
}

export function resetEmail(to: string, token: string): Mail {
  const url = `${clientUrl()}/reset-password?token=${token}`;
  const intro = "We got a request to reset the password for your Owlet account.";
  const note = "This link expires in 30 minutes and works once. If you didn't ask for this, you can ignore this email; your password won't change.";
  return {
    to,
    subject: "Reset your Owlet password",
    text: `${intro}\n\nChoose a new password: ${url}\n\n${note}`,
    html: layout({ title: "Reset your password", intro, button: { label: "Choose a new password", url }, note }),
  };
}

export function alreadyRegisteredEmail(to: string): Mail {
  const url = `${clientUrl()}/login`;
  const intro = "Someone tried to create an Owlet account with this email address, but you already have one.";
  const note = "If it was you, log in or reset your password from the login page. If it wasn't, you can ignore this email; nothing changed.";
  return {
    to,
    subject: "You already have an Owlet account",
    text: `${intro}\n\nLog in: ${url}\n\n${note}`,
    html: layout({ title: "You already have an account", intro, button: { label: "Go to login", url }, note }),
  };
}

export function passwordChangedEmail(to: string): Mail {
  const url = `${clientUrl()}/forgot-password`;
  const intro = "The password for your Owlet account was just changed, and any other devices were signed out.";
  const note = "If this wasn't you, reset your password again right away.";
  return {
    to,
    subject: "Your Owlet password was changed",
    text: `${intro}\n\nNot you? Reset it here: ${url}\n\n${note}`,
    html: layout({ title: "Password changed", intro, button: { label: "This wasn't me", url }, note }),
  };
}