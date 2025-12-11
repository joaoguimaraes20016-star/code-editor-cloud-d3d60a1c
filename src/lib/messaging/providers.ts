// src/lib/messaging/providers.ts
import type { MessageChannel, OutboundMessage, MessageResult } from './types';

export type MessageProviderId = string;

export interface MessageProvider {
  id: MessageProviderId;
  label?: string;
  channels: MessageChannel[];

  send(message: OutboundMessage): Promise<MessageResult>;

  sendBatch?(messages: OutboundMessage[]): Promise<MessageResult[]>;
}

const registry: Partial<Record<MessageChannel, MessageProvider[]>> = {};

/**
 * Called once per real integration (Twilio, Mailgun, Zoom dialer, etc).
 */
export function registerMessageProvider(provider: MessageProvider) {
  for (const channel of provider.channels) {
    if (!registry[channel]) registry[channel] = [];
    registry[channel]!.push(provider);
  }
}

export function getProvidersForChannel(
  channel: MessageChannel,
): MessageProvider[] {
  return registry[channel] ?? [];
}
