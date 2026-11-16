import { createRaindropAISDK } from "@raindrop-ai/ai-sdk";
// biome-ignore lint/performance/noNamespaceImport: Raindrop wraps the whole AI SDK module.
import * as ai from "ai";

/**
 * Raindrop observability. Every chat turn is sent as a `chat_message` event with its trace (model calls, tool calls
 * and tool results). Without RAINDROP_WRITE_KEY nothing is sent.
 */
export const raindrop = createRaindropAISDK({
  // Debug logging for setting up and verifying the integration. Turn it off once events show up in Raindrop.
  events: { debug: true },
  traces: { debug: true },
  writeKey: process.env.RAINDROP_WRITE_KEY,
});

// Wrap a plain copy: in production builds the `ai` namespace is frozen, and a Proxy over it can't return the wrapped
// streamText (non-configurable properties must come back unchanged), so evaluating this module would throw.
export const { streamText } = raindrop.wrap(
  { ...ai },
  {
    context: { eventName: "chat_message" },
    nativeTelemetry: true,
  }
);
