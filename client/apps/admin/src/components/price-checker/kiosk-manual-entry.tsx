import { useRef, useState } from 'react';
import { validBarcode } from './scanner';

export function KioskManualEntry({ onScan }: { onScan: (barcode: string) => void }) {
  const [open, setOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setError('');
    trigger.current?.focus();
  }

  return (
    <>
      <button ref={trigger} className="kiosk-quiet" aria-expanded={open}
        aria-controls={open ? 'manual-entry-form' : undefined}
        onClick={() => open ? close() : setOpen(true)}>
        Enter barcode
      </button>
      {open && (
        <form id="manual-entry-form" className="kiosk-manual"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const value = validBarcode(barcode);
            if (!value) {
              setError('Enter a barcode of 5 to 128 printable characters.');
              return;
            }
            close();
            setBarcode('');
            onScan(value);
          }}>
          <label htmlFor="manual-barcode">Product barcode</label>
          <input id="manual-barcode" value={barcode} onChange={(event) => {
            setBarcode(event.target.value);
            setError('');
          }} aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'manual-barcode-error' : undefined}
            maxLength={128} autoComplete="off" autoFocus />
          <button className="kiosk-primary" type="submit">Check price</button>
          <button className="kiosk-quiet" type="button" onClick={close}>Close</button>
          {error && <p id="manual-barcode-error" className="kiosk-manual-error" role="alert">{error}</p>}
        </form>
      )}
    </>
  );
}
