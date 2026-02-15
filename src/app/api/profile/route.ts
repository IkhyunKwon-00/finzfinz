import { summarizeCompanyProfileWithClaude } from "@/lib/claude";
import { fetchYahooIndustry, fetchYahooQuote } from "@/lib/yahoo";

export const runtime = "nodejs";
export const revalidate = 300;

function getMarketFromQuote(symbol: string, currency?: string | null, exchange?: string | null) {
  const tickerUpper = symbol.toUpperCase();
  const exchangeUpper = (exchange || "").toUpperCase();
  const currencyUpper = (currency || "").toUpperCase();

  if (tickerUpper.endsWith(".KS") || tickerUpper.endsWith(".KQ")) {
    return "Korea";
  }
  if (currencyUpper === "KRW" || ["KSE", "KOE", "KSC", "KOSDAQ"].includes(exchangeUpper)) {
    return "Korea";
  }
  return "USA";
}

function buildFallbackBullets({
  symbol,
  companyName,
  industry,
  market,
}: {
  symbol: string;
  companyName: string;
  industry?: string | null;
  market: string;
}) {
  return [
    `• ${companyName} (${symbol})은 ${market} 시장에 상장된 종목입니다.`,
    `• 핵심 사업 영역은 ${industry || "산업 정보 확인 중"}입니다.`,
    "• 최근 공시/뉴스와 함께 실적, 밸류에이션, 리스크를 함께 확인하세요.",
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [quote, industry] = await Promise.all([
      fetchYahooQuote(symbol),
      fetchYahooIndustry(symbol),
    ]);

    if (!quote) {
      return Response.json({ error: "symbol not found" }, { status: 404 });
    }

    const companyName = quote.longName ?? quote.shortName ?? symbol;
    const market = getMarketFromQuote(symbol, quote.currency ?? null, quote.exchange ?? null);

    const claudeBullets = await summarizeCompanyProfileWithClaude({
      symbol,
      companyName,
      industry,
      market,
    });

    const bullets = claudeBullets ??
      buildFallbackBullets({
        symbol,
        companyName,
        industry,
        market,
      });

    return Response.json({
      symbol,
      companyName,
      market,
      industry: industry ?? null,
      bullets,
      source: claudeBullets ? "claude" : "fallback",
    });
  } catch {
    return Response.json({ error: "failed to build company profile" }, { status: 500 });
  }
}
