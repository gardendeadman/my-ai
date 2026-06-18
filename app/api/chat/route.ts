import { getCharacter } from "@/characters";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse";

const CREDIT_PER_CHAT = 1;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 크레딧 확인
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  const currentCredits = creditRow?.credits ?? 0;
  if (currentCredits < CREDIT_PER_CHAT) {
    return NextResponse.json({ error: "크레딧이 부족해요. 충전 후 이용해주세요.", code: "NO_CREDITS" }, { status: 402 });
  }

  const { messages, characterId } = await request.json();

  const character = getCharacter(characterId);
  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없어요." }, { status: 404 });
  }

  // 크레딧 선차감
  await supabase
    .from("user_credits")
    .update({ credits: currentCredits - CREDIT_PER_CHAT, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  let systemPrompt = character.personality;
  if (character.images && character.images.length > 0) {
    const imageList = character.images
      .map((img, i) => `${i}: ${img.desc}`)
      .join("\n");
    systemPrompt += `\n\n응답 맨 끝에 반드시 [IMG:N] 태그를 붙여. N은 아래 이미지 중 현재 대화 맥락에 가장 어울리는 번호야. 태그 외에 다른 설명은 하지 마.\n${imageList}`;
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
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!geminiRes.ok || !geminiRes.body) {
    // 실패 시 크레딧 환불
    await supabase
      .from("user_credits")
      .update({ credits: currentCredits, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    const err = await geminiRes.json().catch(() => ({}));
    console.error("[Gemini Error]", JSON.stringify(err));
    return NextResponse.json({ error: "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const upstream = geminiRes.body.getReader();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await upstream.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        console.error("[Stream Error]", err);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
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
