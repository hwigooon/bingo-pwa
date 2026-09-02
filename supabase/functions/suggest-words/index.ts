const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const body = await request.json() as { topic?: unknown; count?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 40) : "";
    const requestedCount = typeof body.count === "number" ? Math.round(body.count) : 45;
    const count = Math.min(80, Math.max(25, requestedCount));
    if (!topic) return json({ error: "주제를 입력해 주세요." }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "AI 추천 기능이 아직 설정되지 않았습니다." }, 503);
    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "당신은 한국어 빙고 게임의 단어 큐레이터입니다. 짧고 서로 겹치지 않으며 주제를 바로 떠올릴 수 있는 명사 또는 짧은 명사구만 제안하세요. 번호, 설명, 이모지, 따옴표는 넣지 마세요.",
          },
          {
            role: "user",
            content: `주제: <topic>${topic}</topic>\n서로 다른 빙고 후보 단어를 ${count}개 만들어 주세요. 각 단어는 15자 이내를 권장합니다.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "bingo_word_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                words: {
                  type: "array",
                  minItems: count,
                  maxItems: count,
                  items: { type: "string", minLength: 1, maxLength: 30 },
                },
              },
              required: ["words"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const error = payload.error && typeof payload.error === "object"
        ? (payload.error as { message?: unknown }).message
        : undefined;
      throw new Error(typeof error === "string" ? error : "OpenAI 요청에 실패했습니다.");
    }

    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText) as { words?: unknown };
    const words = Array.isArray(parsed.words)
      ? [...new Set(parsed.words.filter((word): word is string => typeof word === "string").map((word) => word.trim()).filter(Boolean))]
      : [];
    if (words.length < Math.min(25, count)) throw new Error("충분한 추천 단어를 만들지 못했습니다.");
    return json({ words });
  } catch (error) {
    console.error("suggest-words error", error);
    return json(
      { error: error instanceof Error ? error.message : "추천 단어 생성 중 오류가 발생했습니다." },
      500,
    );
  }
});
