'use client';
import { QRCodeCanvas } from 'qrcode.react';

/** The "scan with your phone" QR block shown on the kiosk screens. */
export function PhonePair({ url }: { url: string }) {
  if (!url) return null;
  return (
    <div className="kiosk-phone-qr" role="region" aria-label="Scan with your phone">
      <p className="kiosk-eyebrow">Scan with your phone</p>
      <QRCodeCanvas value={url} size={120} includeMargin />
      <p className="kiosk-small">
        Point your camera here and scan bottles yourself.
      </p>
    </div>
  );
}
