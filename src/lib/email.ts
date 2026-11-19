import nodemailer from "nodemailer";

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendAccountEmail({ to, subject, intro, url, action }: { to: string; subject: string; intro: string; url: string; action: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) throw new Error("Email delivery is not configured.");
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE !== "false", auth: { user, pass: password.replace(/\s+/g, "") } });
  const safeUrl = htmlEscape(url);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `LinguaPlay <${user}>`,
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}\n\nЕсли вы не запрашивали это письмо, просто проигнорируйте его.`,
    html: `<div style="max-width:560px;margin:24px auto;padding:28px;font:16px/1.55 Arial,sans-serif;color:#24334d;border:1px solid #dce5f1;border-radius:18px"><div style="font-weight:800;color:#2862d9;font-size:20px">LinguaPlay</div><h1 style="font-size:23px">${htmlEscape(subject)}</h1><p>${htmlEscape(intro)}</p><p><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;color:#fff;background:#2e63e8;border-radius:10px;text-decoration:none;font-weight:700">${htmlEscape(action)}</a></p><p style="color:#697891;font-size:13px">Если кнопка не открылась, скопируйте ссылку в браузер:<br><a href="${safeUrl}">${safeUrl}</a></p><p style="color:#697891;font-size:13px">Если вы не запрашивали это письмо, просто проигнорируйте его.</p></div>`,
  });
}
