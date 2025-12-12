// src/lib/integrations/smsProvider.ts

export type SmsProviderType = 'stub' | 'twilio' | string;

export interface SmsProviderConfig {
  provider: SmsProviderType;
  fromPhone?: string;
}

export interface SmsPayload {
  to: string;
  body: string;
  meta?: Record<string, any>;
}

export interface SmsSendResult {
  provider: string;
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface SmsProvider {
  sendSms(payload: SmsPayload): Promise<SmsSendResult>;
}

/**
 * Stub SMS provider - logs but doesn't send
 */
class StubSmsProvider implements SmsProvider {
  async sendSms(payload: SmsPayload): Promise<SmsSendResult> {
    const messageId = `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log('[StubSmsProvider] Would send SMS:', {
      to: payload.to,
      body: payload.body,
      messageId,
    });

    return {
      provider: 'stub',
      messageId,
      status: 'sent',
    };
  }
}

/**
 * Build an SMS provider based on config
 * Easily extensible: just add new provider implementations
 */
export function buildSmsProvider(config: SmsProviderConfig): SmsProvider {
  switch (config.provider) {
    case 'stub':
      return new StubSmsProvider();
    
    case 'twilio':
      // Placeholder for future Twilio implementation
      console.warn('[SmsProvider] Twilio not implemented, falling back to stub');
      return new StubSmsProvider();
    
    default:
      console.warn(`[SmsProvider] Unknown provider "${config.provider}", using stub`);
      return new StubSmsProvider();
  }
}
