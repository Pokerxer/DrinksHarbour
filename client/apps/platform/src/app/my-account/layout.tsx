import type { Metadata } from "next";
import AccountShell from "./AccountShell";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your DrinksHarbour account, orders, and preferences.",
  robots: { index: false, follow: false },
};

export default function MyAccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
