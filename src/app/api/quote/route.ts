export const runtime = "nodejs";
export const revalidate = 300;

type QuoteResult = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
  currency?: string | null;
  exchange?: string | null;
};

async function fetchQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("quote fetch failed");
  }
  const data = await res.json();
  const result = data?.quoteResponse?.result?.[0] as QuoteResult | undefined;
  return result ?? null;
}

async function fetchIndustry(symbol: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=assetProfile`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return (
      data?.quoteSummary?.result?.[0]?.assetProfile?.industry ?? null
    ) as string | null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [quote, industry] = await Promise.all([
      fetchQuote(symbol),
      fetchIndustry(symbol),
    ]);
    if (!quote) {
      return Response.json({ error: "symbol not found" }, { status: 404 });
    }
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
