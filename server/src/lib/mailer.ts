import { render } from "@react-email/render";
import { Resend } from "resend";
import type * as React from "react";
import { env, features } from "../config/env.js";
import { logger } from "./logger.js";

let client: Resend | null = null;

function resend(): Resend | null {
  if (!features.email) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export interface SendArgs {
  to: string;
  subject: string;
  element: React.ReactElement;
  /** Grouped in the log so a batch send is one line, not two hundred. */
  kind: string;
}

/**
 * Renders a React Email template and sends it.
 *
 * Without RESEND_API_KEY it renders anyway and logs that it would have sent.
 * Rendering rather than skipping is deliberate: a template that throws on a
 * missing field should fail in development, not the first time a real order is
 * confirmed. The plain-text alternative is generated from the same tree, so it
 * cannot drift from the HTML.
 */
export async function sendEmail(args: SendArgs): Promise<{ sent: boolean }> {
  let html: string;
  let text: string;
  try {
    html = await render(args.element);
    text = await render(args.element, { plainText: true });
  } catch (error) {
    logger.error({ err: error, kind: args.kind }, "email template failed to render");
    return { sent: false };
  }

  const mailer = resend();
  if (!mailer) {
    logger.info(
      { to: args.to, subject: args.subject, kind: args.kind, bytes: html.length },
      "email not sent: RESEND_API_KEY is unset (rendered successfully)",
    );
    return { sent: false };
  }

  try {
    const result = await mailer.emails.send({
      from: env.EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html,
      text,
    });
    if (result.error) {
      logger.error({ err: result.error, kind: args.kind }, "email rejected by resend");
      return { sent: false };
    }
    logger.info({ to: args.to, kind: args.kind, id: result.data?.id }, "email sent");
    return { sent: true };
  } catch (error) {
    // A failed email must never fail the request that triggered it. An order
    // that is paid for is paid for whether or not the receipt went out.
    logger.error({ err: error, kind: args.kind }, "email could not be sent");
    return { sent: false };
  }
}

export function isEmailConfigured(): boolean {
  return features.email;
}
