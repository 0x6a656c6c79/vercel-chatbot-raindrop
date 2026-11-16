import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { raindrop } from "@/lib/ai/raindrop";
import {
  getChatById,
  getMessageById,
  getMessagesByChatId,
  getVotesByChatId,
  voteMessage,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const voteSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  type: z.enum(["up", "down"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:vote").toResponse();
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  let chatId: string;
  let messageId: string;
  let type: "up" | "down";

  try {
    ({ chatId, messageId, type } = voteSchema.parse(await request.json()));
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new ChatbotError("not_found:vote").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:vote").toResponse();
  }

  const [message] = await getMessageById({ id: messageId });

  if (!message || message.chatId !== chatId) {
    return new ChatbotError("not_found:vote").toResponse();
  }

  await voteMessage({
    chatId,
    messageId,
    type,
  });

  // The chat route uses the user message id as the Raindrop event id, so the vote goes on the turn this reply answered.
  const chatMessages = await getMessagesByChatId({ id: chatId });
  const turn = chatMessages
    .slice(
      0,
      chatMessages.findIndex((m) => m.id === messageId)
    )
    .findLast((m) => m.role === "user");

  if (turn) {
    after(() =>
      raindrop.signals.track({
        eventId: turn.id,
        name: type === "up" ? "thumbs_up" : "thumbs_down",
        sentiment: type === "up" ? "POSITIVE" : "NEGATIVE",
      })
    );
  }

  return new Response("Message voted", { status: 200 });
}
