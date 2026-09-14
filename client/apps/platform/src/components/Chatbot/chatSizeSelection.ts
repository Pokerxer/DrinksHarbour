interface ChatSize {
  size?: string;
  displayName?: string;
  name?: string;
  stock?: number;
  pricing?: { websitePrice?: number };
}

const volumeKey = (label: string) => {
  const value = label.trim().toLowerCase();
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ml|cl|l)$/);
  if (!match) return value;
  const multiplier = match[2] === 'l' ? 1000 : match[2] === 'cl' ? 10 : 1;
  return `${Math.round(Number(match[1]) * multiplier * 1000) / 1000}ml`;
};

export function selectChatSize<T extends ChatSize>(sizes: T[], requested?: string | null): T | undefined {
  const available = sizes.filter(size => (size.pricing?.websitePrice || 0) > 0 && (size.stock || 0) > 0);
  if (!requested?.trim()) return available[0];
  const wanted = volumeKey(requested);
  return available.find(size => volumeKey(size.size || size.displayName || size.name || '') === wanted);
}
