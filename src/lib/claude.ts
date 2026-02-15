type ClaudeMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function normalizeBullets(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•\d.\s]+/, "").trim())
    .filter(Boolean);

  const unique: string[] = [];
  for (const line of lines) {
    if (!unique.includes(line)) {
      unique.push(line);
    }
  }

  return unique.slice(0, 3).map((line) => `• ${line}`);
}

export async function summarizeCompanyProfileWithClaude({
  symbol,
  companyName,
  industry,
  market,
}: {
  symbol: string;
  companyName?: string | null;
  industry?: string | null;
  market?: string | null;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = [
    "너는 금융 서비스용 기업 프로필 요약 어시스턴트다.",
    "아래 기업 정보를 바탕으로 한국어로 정확히 3줄, dot(•) 형식 요약을 작성해라.",
    "출력은 순수 텍스트 3줄만 작성하고 다른 설명은 쓰지 마라.",
    `티커: ${symbol}`,
    `기업명: ${companyName || "정보 없음"}`,
    `시장: ${market || "정보 없음"}`,
    `산업: ${industry || "정보 없음"}`,
    "각 줄은 25~45자 사이로 간결하게 작성해라.",
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 220,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ClaudeMessageResponse;
  const text = (data.content || [])
    .filter((item) => item?.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();

  if (!text) {
    return null;
  }

  const bullets = normalizeBullets(text);
  if (bullets.length < 3) {
    return null;
  }

  return bullets;
}
