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
        src="/logo-short.svg"
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
      src="/logo.svg"
      alt="DrinksHarbour"
      width={155}
      height={32}
      className={className}
      {...props}
    />
  );
}
