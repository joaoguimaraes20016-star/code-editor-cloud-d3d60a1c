// src/lib/messaging/dispatcher.ts
import type { OutboundMessage, MessageResult, MessageChannel } from './types';
import { getProvidersForChannel, registerMessageProvider } from './providers';

/**
 * Main entry to send messages from the rest of the app.
 * Uses the first configured provider for that channel.
 */
export async function dispatchMessage(
  message: OutboundMessage,
): Promise<MessageResult> {
  const providers = getProvidersForChannel(message.channel);

  if (!providers.length) {
    console.warn('[dispatcher] no provider configured for channel', message.channel);
    return {
      success: false,
      error: `no_provider_for_${message.channel}`,
    };
  }

  return providers[0].send(message);
}

/**
 * Default "no-op" provider so nothing explodes in dev before you plug real APIs.
 */
class NoopProvider {
  id = 'noop';
  channels: MessageChannel[] = ['sms', 'email', 'voice', 'in_app'];

  async send(): Promise<MessageResult> {
    return {
      success: true,
      providerId: this.id,
    };
  }
}

// Register noop provider immediately so automations don't crash in dev.
registerMessageProvider(new NoopProvider());
