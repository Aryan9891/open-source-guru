import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

/** Sends email. SMTP in every environment (Mailpit in development); faked in tests. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
  close(): Promise<void>;
}

/**
 * The recipient was rejected permanently (SMTP 5xx: unknown mailbox, blocked, …).
 * Retrying won't help: the address is added to `email_suppressions`.
 */
export class PermanentEmailError extends Error {
  override name = "PermanentEmailError";
}

export function createSmtpSender(options: { url: string; from: string }): EmailSender {
  const transport = nodemailer.createTransport(options.url);

  return {
    async send(message) {
      try {
        await transport.sendMail({ from: options.from, ...message });
      } catch (error) {
        const code = (error as { responseCode?: number }).responseCode;
        if (code !== undefined && code >= 500 && code < 600) {
          throw new PermanentEmailError((error as Error).message, { cause: error });
        }
        throw error;
      }
    },
    async close() {
      transport.close();
    },
  };
}

/** Collects messages in memory; for tests. */
export function createMemorySender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
    async close() {},
  };
}
