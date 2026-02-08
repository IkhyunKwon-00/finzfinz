import { fetchYahooIndustry, fetchYahooQuote } from "@/lib/yahoo";

export const runtime = "nodejs";
export const revalidate = 300;

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
    const currentPrice =
      quote.regularMarketPrice ??
      quote.postMarketPrice ??
      quote.preMarketPrice ??
      quote.regularMarketPreviousClose ??
      null;

    return Response.json({
      symbol: quote.symbol ?? symbol,
      shortName: quote.shortName ?? quote.longName,
      longName: quote.longName,
      currentPrice,
      regularMarketChangePercent: quote.regularMarketChangePercent ?? null,
      currency: quote.currency ?? null,
      exchange: quote.exchange ?? null,
      industry,
    });
  } catch {
    return Response.json({ error: "failed to fetch quote" }, { status: 500 });
  }
}
