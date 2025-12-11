// src/lib/messaging/types.ts

export type MessageChannel = 'sms' | 'email' | 'voice' | 'in_app';

export interface OutboundMessage {
  teamId: string;
  channel: MessageChannel;

  // Destinations (only some used depending on channel)
  toPhone?: string;
  toEmail?: string;

  subject?: string;
  text: string;
  html?: string;
  metadata?: Record<string, any>;
}

export interface MessageResult {
  success: boolean;
  providerId?: string;
  providerMessageId?: string;
  error?: string;
}
