// src/lib/integrations/emailProvider.ts

export interface EmailProviderConfig {
  provider: 'generic' | 'convertkit' | 'sendgrid' | 'resend' | string;
  fromEmail: string;
  fromName?: string;
}

/**
 * Normalized payload for sending an email.
 */
export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Thin abstraction so the rest of the app never cares which ESP you're on.
 */
export class EmailProviderClient {
  private cfg: EmailProviderConfig;

  constructor(cfg: EmailProviderConfig) {
    this.cfg = cfg;
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    console.info('[EmailProviderClient] sendEmail stub', {
      provider: this.cfg.provider,
      fromEmail: this.cfg.fromEmail,
      to: payload.to,
      subject: payload.subject,
    });

    // TODO: implement backend call to your chosen ESP.
  }
}
