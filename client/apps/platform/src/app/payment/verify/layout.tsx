import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verifying Payment",
  robots: { index: false, follow: false },
};

export default function PaymentVerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
