import yahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [quote, summary] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, { modules: ["assetProfile"] }),
    ]);
    const industry = summary?.assetProfile?.industry ?? null;
    return Response.json({
      symbol: quote.symbol ?? symbol,
      shortName: quote.shortName ?? quote.longName,
      longName: quote.longName,
      currentPrice:
        quote.regularMarketPrice ??
        quote.postMarketPrice ??
        quote.preMarketPrice ??
        null,
      regularMarketChangePercent: quote.regularMarketChangePercent ?? null,
      currency: quote.currency ?? null,
      exchange: quote.exchange ?? null,
      industry,
    });
  } catch {
    return Response.json({ error: "failed to fetch quote" }, { status: 500 });
  }
}
