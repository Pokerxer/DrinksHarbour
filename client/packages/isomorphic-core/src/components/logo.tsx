// @ts-nocheck
import Image from 'next/image';

interface LogoProps {
  iconOnly?: boolean;
  className?: string;
  [key: string]: any;
}

export default function Logo({ iconOnly = false, className, ...props }: LogoProps) {
  if (iconOnly) {
    return (
      <Image
        src="/logo-short.png"
        alt="DrinksHarbour"
        width={32}
        height={32}
        className={className}
        {...props}
      />
    );
  }
  return (
    <Image
      src="/logo-wordmark.png"
      alt="DrinksHarbour"
      width={2172}
      height={724}
      style={{ width: 155, height: 24, objectFit: 'cover' }}
      sizes="155px"
      className={className}
      {...props}
    />
  );
}
