declare module 'nodemailer' {
  interface MailTransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
  }

  interface MailOptions {
    from?: unknown;
    to?: string;
    subject?: string;
    replyTo?: string;
    html?: string;
    text?: string;
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<unknown>;
  }

  export function createTransport(options: MailTransportOptions): Transporter;
}
