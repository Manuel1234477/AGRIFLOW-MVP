/**
 * Live FX Exchange Rate Service
 * Fetches real-time USDC -> NGN exchange rates from CoinGecko with Binance fallback,
 * caching and auto-refreshing every 5 minutes.
 */

import { useState, useEffect } from 'react';

let cachedRate: { rate: number; fetchedAt: number } | null = null;
const RATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
export const DEFAULT_FALLBACK_RATE = 1500;

/**
 * Fetch live USDC/NGN exchange rate from CoinGecko with Binance fallback.
 */
export async function fetchLiveUsdcNgnRate(): Promise<number> {
  // Return cached rate if within 5-minute TTL window
  if (cachedRate && Date.now() - cachedRate.fetchedAt < RATE_CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  // 1. Primary: CoinGecko USDC/NGN
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn',
      {
        headers: { Accept: 'application/json' },
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { 'usd-coin'?: { ngn?: number } };
      const rate = data['usd-coin']?.ngn;
      if (rate && typeof rate === 'number' && rate > 0) {
        cachedRate = { rate: Math.round(rate), fetchedAt: Date.now() };
        return cachedRate.rate;
      }
    }
  } catch (e) {
    console.warn('CoinGecko USDC rate fetch note:', e);
  }

  // 2. Secondary Fallback: Binance USDT/NGN
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN'
    );
    if (res.ok) {
      const data = (await res.json()) as { price?: string };
      const parsed = parseFloat(data.price || '0');
      if (parsed > 0) {
        cachedRate = { rate: Math.round(parsed), fetchedAt: Date.now() };
        return cachedRate.rate;
      }
    }
  } catch (e) {
    console.warn('Binance fallback rate fetch note:', e);
  }

  return cachedRate?.rate ?? DEFAULT_FALLBACK_RATE;
}

/**
 * React hook to get and auto-refresh the live USDC/NGN rate every 5 minutes.
 */
export function useUsdcNgnRate() {
  const [rate, setRate] = useState<number>(cachedRate?.rate ?? DEFAULT_FALLBACK_RATE);
  const [loading, setLoading] = useState<boolean>(!cachedRate);

  useEffect(() => {
    let isMounted = true;

    async function loadRate() {
      try {
        const liveRate = await fetchLiveUsdcNgnRate();
        if (isMounted) {
          setRate(liveRate);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    }

    loadRate();

    // Auto-refresh rate every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      loadRate();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { rate, loading };
}
