import Groq from "groq-sdk";
import { getCharacter } from "@/characters";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  const { messages, characterId } = await request.json();

  const character = getCharacter(characterId);
  if (!character) {
    return new Response(JSON.stringify({ error: "캐릭터를 찾을 수 없어요." }), {
      status: 404,
    });
  }

  const stream = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "system", content: character.personality },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
