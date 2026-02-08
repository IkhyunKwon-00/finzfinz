const YAHOO_HEADERS = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  accept: "application/json,text/plain,*/*",
  "accept-language": "en-US,en;q=0.9",
};

const SESSION_TTL_MS = 1000 * 60 * 20;

type YahooSession = {
  crumb: string;
  cookie: string;
  expiresAt: number;
};

let cachedSession: YahooSession | null = null;
let sessionPromise: Promise<YahooSession> | null = null;

async function requestYahooSession() {
  const seed = await fetch("https://fc.yahoo.com", {
    redirect: "manual",
    headers: YAHOO_HEADERS,
    cache: "no-store",
  });
  const setCookie = seed.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) {
    throw new Error("missing yahoo cookie");
  }

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...YAHOO_HEADERS, cookie },
    cache: "no-store",
  });
  if (!crumbRes.ok) {
    throw new Error("crumb fetch failed");
  }
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.toLowerCase().includes("unauthorized")) {
    throw new Error("invalid crumb");
  }

  return {
    crumb,
    cookie,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

async function getYahooSession() {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  if (!sessionPromise) {
    sessionPromise = requestYahooSession().finally(() => {
      sessionPromise = null;
    });
  }
  cachedSession = await sessionPromise;
  return cachedSession;
}

async function yahooFetchJson(baseUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const session = await getYahooSession();
  if (session?.crumb) {
    url.searchParams.set("crumb", session.crumb);
  }

  const headers = session?.cookie
    ? { ...YAHOO_HEADERS, cookie: session.cookie }
    : YAHOO_HEADERS;

  const res = await fetch(url.toString(), {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`yahoo fetch failed: ${res.status}`);
  }

  return res.json();
}

export type QuoteResult = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  regularMarketChangePercent?: number | null;
  currency?: string | null;
  exchange?: string | null;
};

export async function fetchYahooQuote(symbol: string) {
  const data = await yahooFetchJson("https://query1.finance.yahoo.com", "/v7/finance/quote", {
    symbols: symbol,
  });
  const result = data?.quoteResponse?.result?.[0] as QuoteResult | undefined;
  return result ?? null;
}

export async function fetchYahooIndustry(symbol: string) {
  try {
    const data = await yahooFetchJson(
      "https://query2.finance.yahoo.com",
      `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
      { modules: "assetProfile" }
    );
    return (
      data?.quoteSummary?.result?.[0]?.assetProfile?.industry ?? null
    ) as string | null;
  } catch {
    return null;
  }
}

export async function fetchYahooChart(symbol: string, range: string, interval: string) {
  const data = await yahooFetchJson(
    "https://query1.finance.yahoo.com",
    `/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { interval, range }
  );
  return data?.chart?.result?.[0] ?? null;
}
