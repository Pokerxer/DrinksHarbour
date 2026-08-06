import { Avatar } from 'rizzui';

const COLORS = [
  'primary',
  'secondary',
  'info',
  'success',
  'warning',
  'danger',
] as const;

/**
 * A stable hash so the same sender always gets the same avatar color — it turns
 * an address into a visual anchor the operator can skim by, not a color that
 * shuffles on every render.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface SenderAvatarProps {
  name: string;
  address: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function SenderAvatar({
  name,
  address,
  size = 'sm',
  className,
}: SenderAvatarProps) {
  const seed = name || address || '?';
  return (
    <Avatar
      name={seed}
      size={size}
      color={COLORS[hashSeed(seed.toLowerCase()) % COLORS.length]}
      className={className}
    />
  );
}
