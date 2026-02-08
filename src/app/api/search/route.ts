export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = Number(searchParams.get("limit") || 6);
  if (!query) {
    return Response.json([]);
  }

  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${limit}&newsCount=0`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return Response.json([]);
    }
    const data = await res.json();
    const quotes = (data.quotes || []).map((item: any) => ({
      symbol: item.symbol,
      shortName: item.shortname ?? item.longname ?? item.name ?? null,
      longName: item.longname ?? item.shortname ?? null,
      exchange: item.exchange ?? null,
      currency: item.currency ?? null,
    }));
    return Response.json(quotes.slice(0, limit));
  } catch {
    return Response.json([]);
  }
}
