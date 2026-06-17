import { getCharacter } from "@/characters";
import { NextResponse } from "next/server";

const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? "https://api.dify.ai";

/**
 * Dify Chat-Messages API 호출 함수 (blocking 모드)
 *
 * @param query        유저가 입력한 메시지
 * @param userId       유저 고유 식별자 (Dify 내부 로그 추적용)
 * @param apiKey       캐릭터별 Dify 앱 API 키
 * @param inputs       Dify 앱에서 정의한 변수 (없어도 빈 객체 {} 필수)
 * @param difyConvId   이전 턴에서 받은 conversation_id (첫 요청 시 빈 문자열)
 */
async function callDify({
  query,
  userId,
  apiKey,
  inputs = {},
  difyConvId = "",
}: {
  query: string;
  userId: string;
  apiKey: string;
  inputs?: Record<string, string>;
  difyConvId?: string;
}) {
  const res = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Dify 인증: 캐릭터별 API 키를 Bearer 토큰으로 전달
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // inputs가 누락되면 Dify가 400 에러를 반환하므로 반드시 포함
      inputs,
      query,
      user: userId,
      // blocking: 응답이 완성될 때까지 기다린 후 한 번에 반환
      response_mode: "blocking",
      // 빈 문자열이면 Dify가 새 대화를 시작하고 conversation_id를 발급
      // 이후 요청에는 발급받은 id를 그대로 넘겨 대화 메모리를 이어감
      conversation_id: difyConvId,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Dify API 오류 ${res.status}: ${errorBody}`);
  }

  const data = await res.json();

  return {
    // Dify가 생성한 최종 텍스트 답변
    answer: data.answer as string,
    // 다음 요청 때 대화를 이어가려면 이 값을 클라이언트가 보관해야 함
    difyConversationId: data.conversation_id as string,
  };
}

export async function POST(request: Request) {
  const { query, characterId, userId, difyConversationId } =
    await request.json();

  // 캐릭터 존재 확인
  const character = getCharacter(characterId);
  if (!character) {
    return NextResponse.json(
      { error: "캐릭터를 찾을 수 없어요." },
      { status: 404 }
    );
  }

  // 캐릭터마다 다른 Dify 앱을 연결하려면 character.difyApiKey 같은 필드를 추가하면 됩니다.
  // 지금은 공통 환경변수 DIFY_API_KEY를 사용합니다.
  const apiKey = process.env.DIFY_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "DIFY_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const { answer, difyConversationId: newDifyConvId } = await callDify({
      query,
      userId: userId ?? "anonymous",
      apiKey,
      // Dify 앱에 변수(예: 캐릭터 이름)가 정의돼 있으면 여기서 넘깁니다.
      inputs: { character_name: character.name },
      difyConvId: difyConversationId ?? "",
    });

    return NextResponse.json({
      answer,
      // 클라이언트가 다음 요청 때 이 값을 그대로 보내야 대화가 이어집니다.
      difyConversationId: newDifyConvId,
    });
  } catch (err) {
    console.error("[Dify] 호출 실패:", err);
    return NextResponse.json(
      { error: "AI 응답에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }
}
