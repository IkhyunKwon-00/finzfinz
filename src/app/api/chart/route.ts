import { fetchYahooChart } from "@/lib/yahoo";

export const runtime = "nodejs";
export const revalidate = 300;

type ChartPointDraft = {
  t: number;
  close?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

type ChartPoint = {
  t: number;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

const RANGE_QUERY: Record<string, string> = {
  "30d": "1mo",
  "3mo": "3mo",
  "1y": "1y",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "30d";
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const rangeQuery = RANGE_QUERY[range] ?? RANGE_QUERY["30d"];
    const result = await fetchYahooChart(symbol, rangeQuery, "1d");
    const timestamps = (result?.timestamp ?? []) as number[];
    const quote = result?.indicators?.quote?.[0];
    const closes = quote?.close ?? [];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];

    const points = timestamps
      .map(
        (timestamp: number, index: number): ChartPointDraft => ({
          t: timestamp * 1000,
          close: closes[index],
          open: opens[index],
          high: highs[index],
          low: lows[index],
        })
      )
      .filter((point): point is ChartPoint => typeof point.close === "number");

    return Response.json({ symbol, points });
  } catch {
    return Response.json({ error: "failed to fetch chart" }, { status: 500 });
  }
}
