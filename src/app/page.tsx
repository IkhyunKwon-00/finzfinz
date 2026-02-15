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

type ProfileSummary = {
  bullets: string[];
  source: 'claude' | 'fallback';
};

type DisplayCurrency = 'KRW' | 'USD';

const DEFAULT_WATCHLIST = [
  '035420.KS',
  '000660.KS',
  '005930.KS',
  '005380.KS',
  'PLTR',
  'TSLA',
  'NVDA',
  'AMZN',
  'GOOGL',
  'IREN',
  'CRWV',
  'NBIS',
];

const REQUIRED_KOREAN_TICKERS = ['035420.KS', '000660.KS', '005930.KS', '005380.KS'];

const STORAGE_KEYS = {
  watchlist: 'finz_watchlist',
  krwRate: 'finz_krw_rate',
  krwPrev: 'finz_krw_prev',
  displayCurrency: 'finz_display_currency',
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

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPriceByCurrency({
  price,
  sourceCurrency,
  displayCurrency,
  krwRate,
}: {
  price: number;
  sourceCurrency: DisplayCurrency;
  displayCurrency: DisplayCurrency;
  krwRate?: number;
}) {
  if (!Number.isFinite(price)) {
    return '-';
  }

  if (sourceCurrency === displayCurrency) {
    return displayCurrency === 'KRW'
      ? `₩${formatNumber(price, 0)}`
      : `$${formatNumber(price, 2)}`;
  }

  if (!krwRate || krwRate <= 0) {
    return '환율 로딩중';
  }

  if (displayCurrency === 'KRW') {
    return `₩${formatNumber(price * krwRate, 0)}`;
  }

  return `$${formatNumber(price / krwRate, 2)}`;
}

function CurrencyToggle({
  displayCurrency,
  onChange,
}: {
  displayCurrency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-30">
      <div className="inline-flex overflow-hidden rounded-md border border-emerald-300 bg-emerald-50/90 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        className={`px-6 py-1.5 text-sm font-semibold transition-colors ${displayCurrency === 'KRW' ? 'bg-emerald-500 text-white' : 'bg-transparent text-slate-400'}`}
        onClick={() => onChange('KRW')}
      >
        KRW
      </button>
      <button
        type="button"
        className={`px-6 py-1.5 text-sm font-semibold transition-colors ${displayCurrency === 'USD' ? 'bg-emerald-500 text-white' : 'bg-transparent text-slate-400'}`}
        onClick={() => onChange('USD')}
      >
        USD
      </button>
      </div>
    </div>
  );
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

function Sparkline({
  points,
  color,
  gradientId,
}: {
  points: ChartPoint[];
  color: string;
  gradientId: string;
}) {
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

function CandlestickChart({
  points,
  sourceCurrency,
  displayCurrency,
  krwRate,
}: {
  points: ChartPoint[];
  sourceCurrency: DisplayCurrency;
  displayCurrency: DisplayCurrency;
  krwRate?: number;
}) {
  const width = 1200;
  const height = 360;
  const paddingTop = 20;
  const paddingBottom = 20;
  const paddingLeft = 16;
  const axisWidth = 90;
  const paddingRight = 12;
  if (!points.length) {
    return (
      <div className="text-sm text-slate-400">차트 데이터를 불러올 수 없습니다.</div>
    );
  }

  const canConvert = sourceCurrency === displayCurrency || (!!krwRate && krwRate > 0);
  const axisCurrency: DisplayCurrency = canConvert ? displayCurrency : sourceCurrency;

  const convertValue = (value: number) => {
    if (sourceCurrency === axisCurrency) {
      return value;
    }
    if (!krwRate || krwRate <= 0) {
      return value;
    }
    return axisCurrency === 'KRW' ? value * krwRate : value / krwRate;
  };

  const converted = points.map((point) => ({
    ...point,
    open: point.open !== undefined ? convertValue(point.open) : undefined,
    high: point.high !== undefined ? convertValue(point.high) : undefined,
    low: point.low !== undefined ? convertValue(point.low) : undefined,
    close: convertValue(point.close),
  }));

  const valid = converted.filter((p) => p.high !== undefined && p.low !== undefined);
  const highs = valid.map((p) => p.high as number);
  const lows = valid.map((p) => p.low as number);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const plotWidth = width - paddingLeft - axisWidth - paddingRight;
  const candleWidth = plotWidth / valid.length;
  const bodyWidth = Math.max(2, candleWidth * 0.6);

  const scaleY = (value: number) =>
    paddingTop + ((max - value) / range) * (height - paddingTop - paddingBottom);

  const buildNiceTicks = (minValue: number, maxValue: number) => {
    const intervals = 5;
    const rawStep = (maxValue - minValue) / intervals || 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
    const residual = rawStep / magnitude;
    let niceResidual = 1;
    if (residual > 1) niceResidual = 2;
    if (residual > 2) niceResidual = 5;
    if (residual > 5) niceResidual = 10;
    const step = niceResidual * magnitude;

    const niceMax = Math.ceil(maxValue / step) * step;
    const niceMin = Math.floor(minValue / step) * step;

    const ticks: number[] = [];
    for (let value = niceMax; value >= niceMin - step * 0.5; value -= step) {
      ticks.push(Number(value.toFixed(8)));
    }
    return ticks;
  };

  const formatAxisValue = (value: number) => {
    const abs = Math.abs(value);
    const digits = axisCurrency === 'USD'
      ? abs >= 100 ? 0 : abs >= 10 ? 1 : 2
      : abs >= 100 ? 0 : 1;
    return formatNumber(value, digits);
  };

  const tickValues = buildNiceTicks(min, max);
  const ticks = tickValues.map((value) => {
    const y = scaleY(value);
    return { y, value };
  });

  const axisX = width - axisWidth;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72">
      <rect width={width} height={height} fill="rgba(0,0,0,0)" />
      {ticks.map((tick) => (
        <line
          key={`grid-${tick.y.toFixed(2)}`}
          x1={paddingLeft}
          x2={axisX}
          y1={tick.y}
          y2={tick.y}
          stroke="rgba(15,23,42,0.18)"
          strokeWidth="1"
        />
      ))}
      {valid.map((point, index) => {
        const open = point.open ?? point.close;
        const close = point.close;
        const high = point.high ?? close;
        const low = point.low ?? close;
        const isUp = close >= open;
        const color = isUp ? '#ff5c6f' : '#3b82f6';
        const x = paddingLeft + index * candleWidth + candleWidth / 2;
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
      <line
        x1={axisX}
        x2={axisX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke="rgba(15,23,42,0.35)"
        strokeWidth="1.2"
      />
      {ticks.map((tick) => (
        <g key={`axis-${tick.y.toFixed(2)}`}>
          <line
            x1={axisX}
            x2={axisX + 6}
            y1={tick.y}
            y2={tick.y}
            stroke="rgba(15,23,42,0.35)"
            strokeWidth="1"
          />
          <text
            x={axisX + 10}
            y={tick.y + 4}
            fontSize="13"
            fill="rgba(15,23,42,0.75)"
          >
            {`${formatAxisValue(tick.value)} ${axisCurrency}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

function WatchlistCard({
  ticker,
  krwRate,
  displayCurrency,
  onDelete,
  onDetail,
}: {
  ticker: string;
  krwRate?: number;
  displayCurrency: DisplayCurrency;
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
  const priceColor = change < 0 ? '#3b82f6' : '#ff5c6f';
  const gradientId = `spark-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className="finz-card p-6 flex flex-col gap-4 finz-fade-in cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onDetail(ticker)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDetail(ticker);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pr-2">
          <div className="text-base md:text-lg font-semibold text-slate-900 break-all leading-[1.45] py-1">
            {quote?.shortName || quote?.longName || '기업명 없음'}
          </div>
          <div className="text-sm text-slate-500">
            {ticker} - {market}
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            className="finz-button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(ticker);
            }}
          >
            X
          </button>
        </div>
      </div>
      <div>
        <div className="text-xl md:text-2xl lg:text-3xl leading-[1.45] py-1 font-semibold break-words" style={{ color: priceColor }}>
          {formatPriceByCurrency({
            price: currentPrice,
            sourceCurrency: market === 'Korea' ? 'KRW' : 'USD',
            displayCurrency,
            krwRate,
          })}
        </div>
        {delta ? <span className={delta.className}>{delta.text}</span> : null}
      </div>
      <Sparkline points={chart} color={priceColor} gradientId={gradientId} />
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
  useEffect(() => {
    const missing = REQUIRED_KOREAN_TICKERS.filter(
      (ticker) => !watchlist.includes(ticker)
    );
    if (missing.length > 0) {
      setWatchlist([...missing, ...watchlist]);
    }
  }, [watchlist, setWatchlist]);
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
  const [displayCurrency, setDisplayCurrency] = useLocalStorageState<DisplayCurrency>(
    STORAGE_KEYS.displayCurrency,
    'KRW',
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
      const items: QuoteData[] = [];
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
        <CurrencyToggle
          displayCurrency={displayCurrency}
          onChange={setDisplayCurrency}
        />
        <div className="finz-container mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8">
            <button
              type="button"
              className="finz-title text-4xl cursor-pointer"
              onClick={() => router.push('/')}
              aria-label="메인으로 이동"
            >
              FINZ
            </button>
          </div>
          <DetailSection
            ticker={activeTicker}
            krwRate={krwRate ?? undefined}
            displayCurrency={displayCurrency}
          />
        </div>
      </main>
    );
  }

  const krwDelta = krwRate && krwPrev ? ((krwRate - krwPrev) / krwPrev) * 100 : null;
  const krwDeltaText = krwDelta !== null ? formatDelta(krwDelta) : null;
  const btcDeltaText = btc ? formatDelta(btc.change) : null;

  return (
    <main className="finz-shell">
      <CurrencyToggle
        displayCurrency={displayCurrency}
        onChange={setDisplayCurrency}
      />
      <div className="finz-container mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-12 finz-fade-in">
          <h1 className="finz-title text-6xl">Finz</h1>
        </div>

        <section className="finz-card p-6 mb-10 finz-fade-in">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
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
                  className="finz-card p-4 flex items-center justify-between cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                    handleDetail(item.symbol);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSearchQuery('');
                      setSuggestions([]);
                      handleDetail(item.symbol);
                    }
                  }}
                >
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {item.symbol}
                    </div>
                    <div className="text-sm text-slate-500">
                      {item.shortName || item.longName || '이름 없음'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="finz-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddTicker(item.symbol);
                    }}
                  >
                    +
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
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
              USD / KRW
            </div>
            <div className="text-lg md:text-xl lg:text-2xl leading-[1.45] py-1 font-semibold text-slate-900 mt-4 break-words">
              {krwRate ? `₩${formatNumber(krwRate, 0)}` : '데이터 불러오는 중'}
            </div>
            {krwDeltaText ? (
              <div className="mt-3">
                <span className={krwDeltaText.className}>{krwDeltaText.text}</span>
              </div>
            ) : null}
            <div className="text-xs text-slate-500 mt-3">Frankfurter API</div>
          </div>
          <div className="finz-card p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
              Bitcoin
            </div>
            <div className="text-lg md:text-xl lg:text-2xl leading-[1.45] py-1 font-semibold text-slate-900 mt-4 break-words">
              {btc
                ? formatPriceByCurrency({
                  price: btc.price,
                  sourceCurrency: 'USD',
                  displayCurrency,
                  krwRate: krwRate ?? undefined,
                })
                : '데이터 불러오는 중'}
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
            <h2 className="text-xl font-semibold text-slate-900 mb-4">관심 종목 - 한국주식</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {koreaTickers.map((ticker) => (
                <WatchlistCard
                  key={ticker}
                  ticker={ticker}
                  krwRate={krwRate ?? undefined}
                  displayCurrency={displayCurrency}
                  onDelete={handleDeleteTicker}
                  onDetail={handleDetail}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">관심 종목 - 미국주식</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {usaTickers.map((ticker) => (
                <WatchlistCard
                  key={ticker}
                  ticker={ticker}
                  krwRate={krwRate ?? undefined}
                  displayCurrency={displayCurrency}
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
            <div className="finz-card p-8 text-center text-slate-500">
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

function DetailSection({
  ticker,
  krwRate,
  displayCurrency,
}: {
  ticker: string;
  krwRate?: number;
  displayCurrency: DisplayCurrency;
}) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

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

  useEffect(() => {
    let isActive = true;
    const loadProfile = async () => {
      try {
        const res = await fetch(`/api/profile?symbol=${encodeURIComponent(ticker)}`);
        if (!res.ok) {
          throw new Error('profile fetch failed');
        }
        const data = (await res.json()) as ProfileSummary;
        if (isActive) {
          setProfile({
            bullets: (data.bullets || []).slice(0, 3),
            source: data.source || 'fallback',
          });
        }
      } catch {
        if (isActive) {
          setProfile(null);
        }
      }
    };
    loadProfile();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  const change = quote?.regularMarketChangePercent ?? 0;
  const delta = formatDelta(change);
  const market = getMarketLabel(ticker, quote || undefined);
  const currentPrice = quote?.currentPrice ?? 0;
  const companyName = quote?.longName || quote?.shortName || ticker;
  const detailPriceColor = change < 0 ? '#3b82f6' : '#ff5c6f';

  const changeAmount =
    Number.isFinite(currentPrice) && Number.isFinite(change) && change > -100
      ? currentPrice - currentPrice / (1 + change / 100)
      : null;

  const changeAmountText = (() => {
    if (changeAmount === null) {
      return null;
    }

    const sourceCurrency: DisplayCurrency = market === 'Korea' ? 'KRW' : 'USD';
    let converted = changeAmount;

    if (sourceCurrency !== displayCurrency) {
      if (!krwRate || krwRate <= 0) {
        return null;
      }
      converted = displayCurrency === 'KRW' ? changeAmount * krwRate : changeAmount / krwRate;
    }

    const sign = converted >= 0 ? '+' : '-';
    const absValue = Math.abs(converted);
    const unit = displayCurrency === 'KRW' ? formatNumber(absValue, 0) : formatNumber(absValue, 2);
    return `${sign}${unit}`;
  })();

  return (
    <div className="space-y-8">
      <div className="min-w-0 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xl md:text-2xl lg:text-3xl leading-[1.45] py-1 font-semibold text-slate-900 break-words">
            {companyName}
          </div>
          <div className="text-sm text-slate-500 mt-1 break-words leading-[1.45] py-0.5">
            {ticker} - {market}
          </div>
        </div>
        <div className="md:shrink-0">
          <div className="mt-1 flex items-center gap-2 md:justify-end">
            <div className="text-xl md:text-2xl lg:text-3xl leading-[1.45] py-1 font-semibold break-words" style={{ color: detailPriceColor }}>
              {formatPriceByCurrency({
                price: currentPrice,
                sourceCurrency: market === 'Korea' ? 'KRW' : 'USD',
                displayCurrency,
                krwRate,
              })}
            </div>
            {changeAmountText ? (
              <span className="text-sm leading-[1.4] font-semibold" style={{ color: detailPriceColor }}>
                {changeAmountText}
              </span>
            ) : null}
            {delta ? <span className={delta.className}>{delta.text}</span> : null}
          </div>
        </div>
      </div>

      <div>
        <div className="text-lg font-semibold text-slate-900 mb-3">기업 프로필</div>
        <section className="finz-card p-8">
          {profile?.bullets?.length ? (
            <ul className="text-slate-700 leading-relaxed space-y-2">
              {profile.bullets.map((line, index) => (
                <li key={`${ticker}-profile-${index}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-500 text-sm">기업 프로필을 생성 중입니다.</div>
          )}
        </section>
      </div>

      <div>
        <div className="text-lg font-semibold text-slate-900 mb-3">차트</div>
        <section className="finz-card p-8">
          <CandlestickChart
            points={chart}
            sourceCurrency={market === 'Korea' ? 'KRW' : 'USD'}
            displayCurrency={displayCurrency}
            krwRate={krwRate}
          />
        </section>
      </div>

      <div>
        <div className="text-lg font-semibold text-slate-900 mb-3">Hot News Zone</div>
        <section className="finz-card p-8">
          <div className="text-slate-500 text-sm">
            뉴스 데이터 연결 전입니다. 다음 단계에서 뉴스 소스/API를 연결하면 이 영역에 최신 이슈를 표시할 수 있습니다.
          </div>
        </section>
      </div>
    </div>
  );
}