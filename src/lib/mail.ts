import "server-only";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { sesClient } from "./aws";
import { absoluteUrl, site } from "./site";

/**
 * Transactional email through Amazon SES (domain theplaintheory.in, DKIM-signed, configuration set
 * for bounce and complaint tracking). Sending is best-effort: callers get `{ sent: false }` with a
 * reason instead of an exception, and show the person another way through (e.g. a link to share).
 *
 * MAIL_FROM unset means email isn't configured (local development): nothing is sent.
 */
export type MailResult = { sent: true } | { sent: false; reason: "not-configured" | "failed" };

interface Message {
  to: string;
  subject: string;
  /** short paragraphs; rendered as plain text and simple branded HTML */
  paragraphs: string[];
  action?: { label: string; url: string };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render({ subject, paragraphs, action }: Message) {
  const text = [...paragraphs, action ? `${action.label}: ${action.url}` : null, "", `${site.name} · ${absoluteUrl("/")}`].filter((l) => l !== null).join("\n\n");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0b1020">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7ee">
<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:600;color:#2e2bd6">${escape(site.name)}</td></tr>
<tr><td style="padding:8px 32px 0;font-size:20px;font-weight:600;line-height:1.3">${escape(subject)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#3b4256">${escape(p)}</td></tr>`).join("")}
${action ? `<tr><td style="padding:24px 32px 4px"><a href="${escape(action.url)}" style="display:inline-block;background:#2e2bd6;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${escape(action.label)}</a></td></tr>
<tr><td style="padding:12px 32px 0;font-size:12px;line-height:1.5;color:#646b80">Or paste this link into your browser:<br>${escape(action.url)}</td></tr>` : ""}
<tr><td style="padding:28px 32px 28px;font-size:12px;color:#646b80;border-top:1px solid #e5e7ee;margin-top:24px">You received this because someone used ${escape(site.name)} with this address. Questions? ${escape(site.email)}</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

export async function sendMail(message: Message): Promise<MailResult> {
  const from = process.env.MAIL_FROM;
  if (!from) return { sent: false, reason: "not-configured" };
  const { text, html } = render(message);
  try {
    await sesClient().send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [message.to] },
        ConfigurationSetName: process.env.MAIL_CONFIGURATION_SET || undefined,
        Content: { Simple: { Subject: { Data: message.subject, Charset: "UTF-8" }, Body: { Text: { Data: text, Charset: "UTF-8" }, Html: { Data: html, Charset: "UTF-8" } } } },
      }),
    );
    return { sent: true };
  } catch (e) {
    // e.g. the domain isn't verified yet, or the account is still in the SES sandbox
    console.error("[mail] couldn't send", (e as { name?: string }).name ?? e);
    return { sent: false, reason: "failed" };
  }
}

/** Team invite for someone without an account yet. */
export const inviteEmail = (to: string, orgName: string, inviter: string, role: string, signupUrl: string) =>
  sendMail({
    to,
    subject: `Join ${orgName} on ${site.name}`,
    paragraphs: [
      `${inviter} invited you to ${orgName} on ${site.name} as ${role === "admin" || role === "auditor" || role === "editor" ? `an ${role}` : `a ${role}`}.`,
      `Create your account with this email address (${to}) and you'll join ${orgName} straight away.`,
    ],
    action: { label: `Join ${orgName}`, url: signupUrl },
  });

/** Someone who already has an account was added to an organization. */
export const addedToOrgEmail = (to: string, orgName: string, inviter: string, role: string) =>
  sendMail({
    to,
    subject: `You now have access to ${orgName}`,
    paragraphs: [`${inviter} added you to ${orgName} on ${site.name} with ${role} access.`, "Switch to it from the organization menu at the top of the dashboard."],
    action: { label: "Open the dashboard", url: absoluteUrl("/app") },
  });
