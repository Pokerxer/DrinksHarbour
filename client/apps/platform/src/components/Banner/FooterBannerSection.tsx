'use client';

import FooterBanner from '@/components/Banner/FooterBanner';

export default function FooterBannerSection() {
  return (
    <footer className="footer-section">
      {/* Newsletter/Promo Layout */}
      <FooterBanner
        placement="footer"
        layout="newsletter"
        showNewsletter={true}
        showSocial={true}
      />

      {/* Features/Promo Banner */}
      <FooterBanner
        placement="footer"
        layout="promo"
      />

      {/* Links Layout */}
      <FooterBanner
        placement="footer"
        layout="links"
        showSocial={true}
      />

      {/* Social/Copyright Layout */}
      <FooterBanner
        placement="footer"
        layout="social"
        showPayment={true}
        showSocial={true}
      />
    </footer>
  );
}
