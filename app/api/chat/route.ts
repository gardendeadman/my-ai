import { getCharacter } from "@/characters";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callGemini(body: object, retries = 2): Promise<Response> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if ((res.status === 503 || res.status === 429) && retries > 0) {
    await new Promise((r) => setTimeout(r, 1000));
    return callGemini(body, retries - 1);
  }

  return res;
}

async function callClaude(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

function makeSSEResponse(text: string): Response {
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

  const geminiRes = await callGemini({
    system_instruction: { parts: [{ text: character.personality }] },
    contents,
    generationConfig: { maxOutputTokens: 1024 },
  });

  if (geminiRes.ok) {
    const json = await geminiRes.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return makeSSEResponse(text);
  }

  // Gemini 실패 시 Claude Haiku로 폴백
  const errorBody = await geminiRes.json().catch(() => ({}));
  console.warn(`[Gemini ${geminiRes.status}] Claude Haiku로 폴백`, JSON.stringify(errorBody));

  try {
    const text = await callClaude(character.personality, messages);
    return makeSSEResponse(text);
  } catch (err) {
    console.error("[Claude Haiku Error]", err);
    return NextResponse.json({ error: "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }
}
