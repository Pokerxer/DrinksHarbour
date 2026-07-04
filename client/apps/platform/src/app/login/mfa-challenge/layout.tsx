import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MFA Verification",
  description: "Complete your multi-factor authentication to securely access your DrinksHarbour account.",
  robots: { index: false, follow: false },
};

export default function MfaChallengeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
