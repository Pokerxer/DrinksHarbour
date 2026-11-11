'use client';
import { QRCodeCanvas } from 'qrcode.react';

import { useId, useState } from 'react';

export function PhonePair({ url, onReveal }: { url: string; onReveal?: () => void }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  if (!url) return null;
  return (
    <div className="kiosk-phone-pair">
      <button
        className="kiosk-quiet"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        onClick={() => {
          if (!visible) onReveal?.();
          setVisible(!visible);
        }}
      >
        {visible ? 'Hide QR code' : 'Use your phone'}
      </button>
      {visible && (
        <div id={id} className="kiosk-phone-qr" role="region" aria-label="Pair your phone">
          <QRCodeCanvas value={url} size={148} marginSize={4} />
          <p className="kiosk-small">Scan this QR code with your phone camera to continue.</p>
        </div>
      )}
    </div>
  );
}
