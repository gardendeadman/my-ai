import { getCharacter } from "@/characters";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

export async function POST(request: Request) {
  const { messages, characterId } = await request.json();

  const character = getCharacter(characterId);
  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없어요." }, { status: 404 });
  }

  const contents = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiRes = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: character.personality }] },
      contents,
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  const json = await geminiRes.json();

  if (!geminiRes.ok) {
    console.error("[Gemini Error]", JSON.stringify(json));
    return NextResponse.json({ error: JSON.stringify(json) }, { status: 502 });
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // 스트리밍 형식 유지 (page.tsx SSE 파서와 호환)
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      if (text) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
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
