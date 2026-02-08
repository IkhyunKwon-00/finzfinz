export const revalidate = 300;

export async function GET() {
  try {
    const resToday = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=KRW",
      { cache: "no-store" }
    );
    if (!resToday.ok) {
      throw new Error("forex latest failed");
    }
    const dataToday = await resToday.json();
    const rate = dataToday?.rates?.KRW ?? 0;
    const latestDate = dataToday?.date
      ? new Date(dataToday.date)
      : new Date();

    let prevRate = 0;
    for (let i = 1; i <= 7; i += 1) {
      const target = new Date(latestDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = target.toISOString().slice(0, 10);
      const resPrev = await fetch(
        `https://api.frankfurter.app/${dateStr}?from=USD&to=KRW`,
        { cache: "no-store" }
      );
      if (!resPrev.ok) {
        continue;
      }
      const dataPrev = await resPrev.json();
      prevRate = dataPrev?.rates?.KRW ?? 0;
      if (prevRate > 0) {
        break;
      }
    }

    return Response.json({ rate, prevRate });
  } catch {
    return Response.json({ rate: 0, prevRate: 0 }, { status: 500 });
  }
}
