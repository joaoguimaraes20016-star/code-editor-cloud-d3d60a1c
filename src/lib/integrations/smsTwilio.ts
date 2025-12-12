// src/lib/integrations/smsTwilio.ts

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhone: string;
}

/**
 * This is a LIGHTWEIGHT stub. It doesn't actually hit Twilio yet.
 * You can later replace the body of sendSms() with a real API call
 * from your backend / edge function.
 */
export class TwilioClient {
  private cfg: TwilioConfig;

  constructor(cfg: TwilioConfig) {
    this.cfg = cfg;
  }

  async sendSms(params: { to: string; body: string }): Promise<void> {
    console.info('[TwilioClient] sendSms stub', {
      from: this.cfg.fromPhone,
      to: params.to,
      body: params.body,
    });

    // TODO: implement real Twilio call via your server.
    // Keep this empty on the front-end so builds never break.
  }
}
