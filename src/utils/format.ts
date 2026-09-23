export function formatCurrency(amount: number, currency = 'NGN'): string {
  if (currency === 'NGN') {
    return `₦${amount.toLocaleString('en-NG')}`;
  }
  if (currency === 'USDC' || currency === 'XLM') {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString('en-US')} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatCommodity(type: string): string {
  const map: Record<string, string> = {
    maize: 'Yellow Maize', rice: 'Rice', soybean: 'Soybean',
    sorghum: 'White Sorghum', beans: 'Beans', yam: 'Yam',
    wheat: 'Wheat', cassava: 'Cassava', millet: 'Millet', groundnut: 'Groundnut',
  };
  return map[type] ?? type;
}

export const COMMODITY_ICONS: Record<string, string> = {
  maize: '🌽', rice: '🌾', soybean: '🫘', sorghum: '🌿',
  beans: '🫘', yam: '🍠', wheat: '🌾', cassava: '🥔',
  millet: '🌾', groundnut: '🥜',
};
