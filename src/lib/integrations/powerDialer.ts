// src/lib/integrations/powerDialer.ts

export interface PowerDialerConfig {
  provider: 'none' | 'phoneburner' | 'close' | 'custom' | string;
  apiKey?: string;
  baseUrl?: string;
}

export interface DialerContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  tags?: string[];
  meta?: Record<string, any>;
}

export class PowerDialerClient {
  private cfg: PowerDialerConfig;

  constructor(cfg: PowerDialerConfig) {
    this.cfg = cfg;
  }

  async pushContact(contact: DialerContact): Promise<void> {
    console.info('[PowerDialerClient] pushContact stub', {
      provider: this.cfg.provider,
      contact,
    });

    // TODO: implement provider-specific API call.
  }

  async startCallSession(contactIds: string[]): Promise<void> {
    console.info('[PowerDialerClient] startCallSession stub', {
      provider: this.cfg.provider,
      contactIds,
    });

    // TODO: implement provider-specific API call.
  }
}
