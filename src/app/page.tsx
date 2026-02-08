'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type QuoteData = {
  symbol: string;
  shortName?: string;
  longName?: string;
  currentPrice?: number;
  regularMarketChangePercent?: number;
  currency?: string;
  exchange?: string;
  industry?: string;
};

type ChartPoint = {
  t: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
};

const DEFAULT_WATCHLIST = [
  'PLTR',
  'TSLA',
  'NVDA',
  'AMZN',
  'GOOGL',
  'IREN',
  'CRWV',
  'NBIS',
  '000660.KS',
  '005930.KS',
];

const KOREAN_COMPANIES: Record<string, string> = {
  '삼성전자': '005930.KS',
  삼성: '005930.KS',
  lg전자: '066570.KS',
  lg: '066570.KS',
  현대차: '005380.KS',
  현대: '005380.KS',
  기아: '000270.KS',
  sk하이닉스: '000660.KS',
  인텔: 'INTC',
  intel: 'INTC',
  nvidia: 'NVDA',
  엔비디아: 'NVDA',
  테슬라: 'TSLA',
  tesla: 'TSLA',
  아마존: 'AMZN',
  amazon: 'AMZN',
  애플: 'AAPL',
  apple: 'AAPL',
  구글: 'GOOGL',
  google: 'GOOGL',
  마이크로소프트: 'MSFT',
  microsoft: 'MSFT',
};

const STORAGE_KEYS = {
  watchlist: 'finz_watchlist',
  krwRate: 'finz_krw_rate',
  krwPrev: 'finz_krw_prev',
};

function getMarketLabel(ticker: string, info?: QuoteData) {
  const exchange = (info?.exchange || '').toUpperCase();
  const currency = (info?.currency || '').toUpperCase();
  const tickerUpper = ticker.toUpperCase();
  if (tickerUpper.endsWith('.KS') || tickerUpper.endsWith('.KQ')) {
    return 'Korea';
  }
  if (currency === 'KRW' || ['KSE', 'KOE', 'KSC', 'KOSDAQ'].includes(exchange)) {
    return 'Korea';
  }
  return 'USA';
}

function formatUsdKrw(priceUsd: number, krwRate?: number) {
  if (!priceUsd || !krwRate) {
    return `USD ${priceUsd.toFixed(2)}`;
  }
  const krw = priceUsd * krwRate;
  return `KRW ${krw.toFixed(0)} (USD ${priceUsd.toFixed(2)})`;
}

function formatDelta(delta?: number) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) {
    return null;
  }
  const isUp = delta >= 0;
  const sign = isUp ? '+' : '';
  return {
    text: `${sign}${delta.toFixed(2)}%`,
    className: isUp ? 'finz-pill up' : 'finz-pill down',
  };
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem(key);
    if (saved) {
      try {
        setValue(JSON.parse(saved) as T);
      } catch {
        setValue(initial);
      }
    }
  }, [key, initial]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

async function getStateValue(key: string) {
  try {
    const res = await fetch(`/api/state?key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { value: number | null };
    return typeof data.value === 'number' ? data.value : null;
  } catch {
    return null;
  }
}

async function setStateValue(key: string, value: number) {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  } catch {
    // ignore network errors
  }
}

function Sparkline({ points, color }: { points: ChartPoint[]; color: string }) {
  const width = 320;
  const height = 120;
  if (!points.length) {
    return (
      <div className="text-sm text-slate-400">차트 데이터를 불러올 수 없습니다.</div>
    );
  }
  const values = points.map((p) => p.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const polyline = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
      />
      <polygon
        points={`0,${height} ${polyline} ${width},${height}`}
        fill="url(#spark-fill)"
      />
    </svg>
  );
}

function CandlestickChart({ points }: { points: ChartPoint[] }) {
  const width = 1200;
  const height = 360;
  const padding = 20;
  if (!points.length) {
    return (
      <div className="text-sm text-slate-400">차트 데이터를 불러올 수 없습니다.</div>
    );
  }

  const valid = points.filter((p) => p.high !== undefined && p.low !== undefined);
  const highs = valid.map((p) => p.high as number);
  const lows = valid.map((p) => p.low as number);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const candleWidth = width / valid.length;
  const bodyWidth = Math.max(2, candleWidth * 0.6);

  const scaleY = (value: number) =>
    padding + ((max - value) / range) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72">
      <rect width={width} height={height} fill="rgba(0,0,0,0)" />
      {valid.map((point, index) => {
        const open = point.open ?? point.close;
        const close = point.close;
        const high = point.high ?? close;
        const low = point.low ?? close;
        const isUp = close >= open;
        const color = isUp ? '#00e58f' : '#ff5c6f';
        const x = index * candleWidth + candleWidth / 2;
        const yOpen = scaleY(open);
        const yClose = scaleY(close);
        const yHigh = scaleY(high);
        const yLow = scaleY(low);
        const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));
        const bodyY = Math.min(yOpen, yClose);
        return (
          <g key={`${point.t}-${index}`}>
            <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth="2" />
            <rect
              x={x - bodyWidth / 2}
              y={bodyY}
              width={bodyWidth}
              height={bodyHeight}
              fill={color}
              rx="2"
            />
          </g>
        );
      })}
    </svg>
  );
}

function WatchlistCard({
  ticker,
  krwRate,
  onDelete,
  onDetail,
}: {
  ticker: string;
  krwRate?: number;
  onDelete: (ticker: string) => void;
  onDetail: (ticker: string) => void;
}) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`);
        if (!res.ok) {
          throw new Error('quote fetch failed');
        }
        const data = (await res.json()) as QuoteData;
        if (isActive) {
          setQuote(data);
        }
      } catch {
        if (isActive) {
          setQuote(null);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(ticker)}&range=30d`);
        if (!res.ok) {
          throw new Error('chart fetch failed');
        }
        const data = (await res.json()) as { points: ChartPoint[] };
        if (isActive) {
          setChart(data.points || []);
        }
      } catch {
        if (isActive) {
          setChart([]);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  const currentPrice = quote?.currentPrice ?? 0;
  const change = quote?.regularMarketChangePercent ?? 0;
  const delta = formatDelta(change);
  const market = getMarketLabel(ticker, quote || undefined);
  const priceColor = change < 0 ? '#ff5c6f' : '#00e58f';

  return (
    <div className="finz-card p-6 flex flex-col gap-4 finz-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">
            {quote?.shortName || quote?.longName || '기업명 없음'}
          </div>
          <div className="text-sm text-slate-400">
            {ticker} - {market}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="finz-button"
            onClick={() => onDetail(ticker)}
          >
            상세
          </button>
          <button
            type="button"
            className="finz-button"
            onClick={() => onDelete(ticker)}
          >
            제거
          </button>
        </div>
      </div>
      <div>
        <div className="text-3xl font-semibold" style={{ color: priceColor }}>
          {market === 'Korea'
            ? `KRW ${currentPrice.toFixed(0)}`
            : formatUsdKrw(currentPrice, krwRate)}
        </div>
        {delta ? <span className={delta.className}>{delta.text}</span> : null}
      </div>
      <Sparkline points={chart} color={priceColor} />
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTicker = searchParams.get('ticker');

  const [watchlist, setWatchlist] = useLocalStorageState(
    STORAGE_KEYS.watchlist,
    DEFAULT_WATCHLIST,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<QuoteData[]>([]);
  const [krwRate, setKrwRate] = useLocalStorageState<number | null>(
    STORAGE_KEYS.krwRate,
    null,
  );
  const [krwPrev, setKrwPrev] = useLocalStorageState<number | null>(
    STORAGE_KEYS.krwPrev,
    null,
  );
  const [btc, setBtc] = useState<{ price: number; change: number } | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;
    const loadRates = async () => {
      try {
        const res = await fetch('/api/forex');
        if (!res.ok) {
          throw new Error('forex fetch failed');
        }
        const data = (await res.json()) as { rate: number; prevRate: number };
        if (isActive) {
          setKrwRate(data.rate);
          setKrwPrev(data.prevRate);
          if (data.prevRate > 0) {
            setStateValue('krw_rate_prev', data.prevRate);
          }
          if (data.rate > 0) {
            setStateValue('krw_rate_today', data.rate);
          }
        }
      } catch {
        if (isActive) {
          setKrwRate(krwRate ?? null);
        }
      }
    };
    loadRates();
    return () => {
      isActive = false;
    };
  }, [krwRate, setKrwPrev, setKrwRate]);

  useEffect(() => {
    let isActive = true;
    const hydrateFromDb = async () => {
      if (krwRate !== null && krwPrev !== null) {
        return;
      }
      const [dbPrev, dbToday] = await Promise.all([
        getStateValue('krw_rate_prev'),
        getStateValue('krw_rate_today'),
      ]);
      if (!isActive) {
        return;
      }
      if (dbPrev !== null && krwPrev === null) {
        setKrwPrev(dbPrev);
      }
      if (dbToday !== null && krwRate === null) {
        setKrwRate(dbToday);
      }
    };
    hydrateFromDb();
    return () => {
      isActive = false;
    };
  }, [krwPrev, krwRate, setKrwPrev, setKrwRate]);

  useEffect(() => {
    let isActive = true;
    const loadBtc = async () => {
      try {
        const res = await fetch('/api/bitcoin');
        if (!res.ok) {
          throw new Error('btc fetch failed');
        }
        const data = (await res.json()) as { price: number; change: number };
        if (isActive) {
          setBtc(data);
        }
      } catch {
        if (isActive) {
          setBtc(null);
        }
      }
    };
    loadBtc();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      const localMatch = KOREAN_COMPANIES[query] || KOREAN_COMPANIES[query.toLowerCase()];
      const items: QuoteData[] = [];
      if (localMatch) {
        try {
          const res = await fetch(`/api/quote?symbol=${encodeURIComponent(localMatch)}`);
          if (res.ok) {
            items.push(await res.json());
          }
        } catch {
          // ignore
        }
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`);
        if (res.ok) {
          const data = (await res.json()) as QuoteData[];
          items.push(...data);
        }
      } catch {
        // ignore
      }
      const unique = new Map<string, QuoteData>();
      items.forEach((item) => {
        if (item?.symbol) {
          unique.set(item.symbol, item);
        }
      });
      setSuggestions(Array.from(unique.values()).slice(0, 6));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleAddTicker = (ticker: string) => {
    const symbol = ticker.toUpperCase();
    if (!watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const handleDeleteTicker = (ticker: string) => {
    setWatchlist(watchlist.filter((item) => item !== ticker));
  };

  const handleDetail = (ticker: string) => {
    router.push(`/?ticker=${encodeURIComponent(ticker)}`);
  };

  const handleBack = () => {
    router.push('/');
  };

  const { usaTickers, koreaTickers } = useMemo(() => {
    const usa: string[] = [];
    const korea: string[] = [];
    watchlist.forEach((ticker) => {
      if (ticker.toUpperCase().endsWith('.KS') || ticker.toUpperCase().endsWith('.KQ')) {
        korea.push(ticker);
      } else {
        usa.push(ticker);
      }
    });
    return { usaTickers: usa, koreaTickers: korea };
  }, [watchlist]);

  if (activeTicker) {
    return (
      <main className="finz-shell">
        <div className="finz-container mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="finz-title text-4xl">Finz Detail</div>
              <div className="text-sm text-slate-400">{activeTicker}</div>
            </div>
            <button type="button" className="finz-button" onClick={handleBack}>
              메인으로
            </button>
          </div>
          <DetailSection ticker={activeTicker} krwRate={krwRate ?? undefined} />
        </div>
      </main>
    );
  }

  const krwDelta = krwRate && krwPrev ? ((krwRate - krwPrev) / krwPrev) * 100 : null;
  const krwDeltaText = krwDelta !== null ? formatDelta(krwDelta) : null;
  const btcDeltaText = btc ? formatDelta(btc.change) : null;

  return (
    <main className="finz-shell">
      <div className="finz-container mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-12 finz-fade-in">
          <h1 className="finz-title text-6xl">Finz</h1>
          <p className="text-slate-300 mt-3">
            개인 주식 대시보드: 관심 종목과 시장 흐름을 한 화면에서 확인하세요.
          </p>
        </div>

        <section className="finz-card p-6 mb-10 finz-fade-in">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Search
          </div>
          <div className="mt-4">
            <input
              className="finz-input"
              placeholder="기업명 또는 종목코드 입력 (예: Apple, AAPL, 삼성전자)"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {suggestions.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {suggestions.map((item) => (
                <div
                  key={item.symbol}
                  className="finz-card p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-base font-semibold text-white">
                      {item.symbol}
                    </div>
                    <div className="text-sm text-slate-400">
                      {item.shortName || item.longName || '이름 없음'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="finz-button"
                    onClick={() => handleAddTicker(item.symbol)}
                  >
                    추가
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">
              최소 2글자를 입력하면 자동완성 후보가 표시됩니다.
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="finz-card p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
              USD / KRW
            </div>
            <div className="text-3xl font-semibold text-white mt-4">
              {krwRate ? `KRW ${krwRate.toFixed(0)}` : '데이터 불러오는 중'}
            </div>
            {krwDeltaText ? (
              <div className="mt-3">
                <span className={krwDeltaText.className}>{krwDeltaText.text}</span>
              </div>
            ) : null}
            <div className="text-xs text-slate-500 mt-3">Frankfurter API</div>
          </div>
          <div className="finz-card p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Bitcoin
            </div>
            <div className="text-3xl font-semibold text-white mt-4">
              {btc ? `USD ${btc.price.toFixed(0)}` : '데이터 불러오는 중'}
            </div>
            {btcDeltaText ? (
              <div className="mt-3">
                <span className={btcDeltaText.className}>{btcDeltaText.text}</span>
              </div>
            ) : null}
            <div className="text-xs text-slate-500 mt-3">CoinGecko API</div>
          </div>
        </section>

        <section className="space-y-10">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">관심 종목 - 미국주식</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {usaTickers.map((ticker) => (
                <WatchlistCard
                  key={ticker}
                  ticker={ticker}
                  krwRate={krwRate ?? undefined}
                  onDelete={handleDeleteTicker}
                  onDetail={handleDetail}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">관심 종목 - 한국주식</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {koreaTickers.map((ticker) => (
                <WatchlistCard
                  key={ticker}
                  ticker={ticker}
                  krwRate={krwRate ?? undefined}
                  onDelete={handleDeleteTicker}
                  onDetail={handleDetail}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="finz-shell">
          <div className="finz-container mx-auto max-w-6xl px-6 py-16">
            <div className="finz-card p-8 text-center text-slate-400">
              로딩 중...
            </div>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function DetailSection({ ticker, krwRate }: { ticker: string; krwRate?: number }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);

  useEffect(() => {
    let isActive = true;
    const loadQuote = async () => {
      try {
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`);
        if (!res.ok) {
          throw new Error('quote fetch failed');
        }
        const data = (await res.json()) as QuoteData;
        if (isActive) {
          setQuote(data);
        }
      } catch {
        if (isActive) {
          setQuote(null);
        }
      }
    };
    loadQuote();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  useEffect(() => {
    let isActive = true;
    const loadChart = async () => {
      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(ticker)}&range=1y`);
        if (!res.ok) {
          throw new Error('chart fetch failed');
        }
        const data = (await res.json()) as { points: ChartPoint[] };
        if (isActive) {
          setChart(data.points || []);
        }
      } catch {
        if (isActive) {
          setChart([]);
        }
      }
    };
    loadChart();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  const change = quote?.regularMarketChangePercent ?? 0;
  const delta = formatDelta(change);
  const market = getMarketLabel(ticker, quote || undefined);
  const currentPrice = quote?.currentPrice ?? 0;

  return (
    <div className="finz-card p-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <div>
          <div className="text-3xl font-semibold text-white">
            {quote?.longName || quote?.shortName || ticker}
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {ticker} - {market} - {quote?.industry || '산업 정보 없음'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold text-white">
            {market === 'Korea'
              ? `KRW ${currentPrice.toFixed(0)}`
              : formatUsdKrw(currentPrice, krwRate)}
          </div>
          {delta ? <span className={delta.className}>{delta.text}</span> : null}
        </div>
      </div>

      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">
          1Y Candlestick
        </div>
        <CandlestickChart points={chart} />
      </div>
      <div className="mt-6 text-sm text-slate-400">
        다음 단계: 이 영역에 뉴스 요약 및 인사이트 위젯을 추가할 수 있습니다.
      </div>
    </div>
  );
}