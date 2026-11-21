import { Resend } from "resend";

/**
 * Sending auth emails. With `RESEND_API_KEY` and `EMAIL_FROM` set, Resend sends them; otherwise (local
 * development) the message and its link are printed to the server console instead. Keys are never logged.
 */
export type Email = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  readonly kind: "resend" | "console";
  send(email: Email): Promise<void>;
}

export function createConsoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    kind: "console",
    async send(email) {
      log(
        `[email] (not sent: RESEND_API_KEY/EMAIL_FROM unset) to ${email.to}: ${email.subject}\n${email.text}`,
      );
    },
  };
}

export function createResendMailer(apiKey: string, from: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    kind: "resend",
    async send(email) {
      const { error } = await resend.emails.send({ from, ...email });
      if (error) throw new Error(`Email not sent (${error.name}).`);
    },
  };
}

export function mailerFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): Mailer {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  return key && from ? createResendMailer(key, from) : createConsoleMailer();
}

// --- Messages -----------------------------------------------------------------------------------------------

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function message(
  to: string,
  subject: string,
  paragraphs: string[],
  link: { label: string; url: string },
): Email {
  const text = [...paragraphs, `${link.label}: ${link.url}`, "— algovizlib"].join("\n\n");
  const html = [
    `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5;color:#1c1917">`,
    ...paragraphs.map((p) => `<p>${escape(p)}</p>`),
    `<p><a href="${escape(link.url)}" style="color:#c2410c">${escape(link.label)}</a></p>`,
    `<p style="color:#78716c;font-size:13px">If the button doesn't work, paste this link into your browser:<br>${escape(link.url)}</p>`,
    `</div>`,
  ].join("");
  return { to, subject, text, html };
}

export const emails = {
  verify: (to: string, url: string) =>
    message(
      to,
      "Verify your email for algovizlib",
      [
        "Thanks for creating an algovizlib account. Confirm this is your email address so your progress can sync to your account.",
        "The link works once and expires in 24 hours. If you didn't sign up, ignore this email.",
      ],
      { label: "Verify my email", url },
    ),
  alreadyRegistered: (to: string, loginUrl: string, resetUrl: string) =>
    message(
      to,
      "You already have an algovizlib account",
      [
        "Someone (hopefully you) tried to create an algovizlib account with this email address, but you already have one.",
        `Sign in instead. If you've forgotten your password, reset it here: ${resetUrl}`,
        "If this wasn't you, you can ignore this email; nothing has changed.",
      ],
      { label: "Sign in", url: loginUrl },
    ),
  reset: (to: string, url: string) =>
    message(
      to,
      "Reset your algovizlib password",
      [
        "We got a request to reset the password for this email address.",
        "The link works once and expires in 30 minutes. If you didn't ask for it, ignore this email; your password stays the same.",
      ],
      { label: "Choose a new password", url },
    ),
};
