import yahooFinance from "yahoo-finance2";

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

const RANGE_DAYS: Record<string, number> = {
  "30d": 30,
  "3mo": 90,
  "1y": 365,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "30d";
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  const days = RANGE_DAYS[range] ?? RANGE_DAYS["30d"];
  const now = new Date();
  const period1 = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2: now,
      interval: "1d",
    });

    const timestamps = (result.timestamp ?? []) as number[];
    const quote = result.indicators?.quote?.[0];
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
