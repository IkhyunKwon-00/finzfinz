export const revalidate = 300;

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error("btc fetch failed");
    }
    const data = await res.json();
    const price = data?.bitcoin?.usd ?? 0;
    const change = data?.bitcoin?.usd_24h_change ?? 0;
    return Response.json({ price, change });
  } catch {
    return Response.json({ price: 0, change: 0 }, { status: 500 });
  }
}
