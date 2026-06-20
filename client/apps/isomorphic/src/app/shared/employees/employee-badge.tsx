'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { PiX, PiPrinterBold, PiDownloadSimpleBold } from 'react-icons/pi';
import { type Employee } from '@/services/employee.service';
import { ROLE_META, fullName, initials } from './employee-profile-form';

const BRAND = '#b20202';

// A stable, human-readable employee code derived from the Mongo id.
function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

// What the QR encodes: the RFID/badge number when present (so a single scan
// works at the POS / attendance reader), otherwise the employee id.
function qrPayload(e: Employee): string {
  return e.employeeProfile?.attendance?.rfidBadge?.trim() || e._id;
}

// Fetch a remote image and inline it as a data URL (needed for jsPDF, which
// can't pull cross-origin URLs reliably). Returns null on failure.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-200 py-1.5 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <span className="truncate text-right text-sm font-semibold text-gray-800">
        {value || '—'}
      </span>
    </div>
  );
}

export default function EmployeeBadge({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  // Hidden, high-resolution QR canvas used to rasterise into the PDF / print.
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);

  const name = fullName(employee);
  const role = ROLE_META[employee.role];
  const code = shortId(employee._id);
  const rfid = employee.employeeProfile?.attendance?.rfidBadge?.trim() || '';
  const qrValue = qrPayload(employee);
  const issued = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const qrDataUrl = () => qrRef.current?.toDataURL('image/png') ?? '';

  // Print the on-screen badge directly via the browser's print dialog. A
  // print-only stylesheet (rendered below) hides everything except the badge
  // card, so there's no pop-up to be blocked and the photo/QR already on screen
  // are guaranteed to be loaded.
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      // CR80 portrait card: 53.98 × 85.6 mm.
      const W = 53.98;
      const H = 85.6;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [W, H],
      });
      const M = 5;
      const R: [number, number, number] = [178, 2, 2]; // brand red, numeric RGB

      // Header band.
      doc.setFillColor(...R);
      doc.rect(0, 0, W, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('DRINKSHARBOUR', W / 2, 9, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('STAFF ID CARD', W / 2, 16, { align: 'center' });

      // Photo (or initials disc) straddling the header.
      const pSize = 22;
      const px = (W - pSize) / 2;
      const py = 11;
      const photo = employee.avatar ? await toDataUrl(employee.avatar) : null;
      if (photo) {
        try {
          doc.addImage(photo, 'JPEG', px, py, pSize, pSize, undefined, 'FAST');
        } catch {
          /* ignore unsupported image format */
        }
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.8);
        doc.roundedRect(px, py, pSize, pSize, 3, 3, 'S');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(W / 2, py + pSize / 2, pSize / 2, 'F');
        doc.setTextColor(...R);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(initials(employee), W / 2, py + pSize / 2 + 1.8, {
          align: 'center',
        });
      }

      // Name + role.
      let y = py + pSize + 6;
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(name, W / 2, y, { align: 'center', maxWidth: W - 6 });
      y += 5;
      doc.setTextColor(...R);
      doc.setFontSize(7);
      doc.text(role.label.toUpperCase(), W / 2, y, { align: 'center' });

      // Info rows.
      y += 5;
      const rows: [string, string][] = [
        ['EMPLOYEE ID', code],
        ['BADGE / RFID', rfid || '—'],
        ['EMAIL', employee.email],
        ['ISSUED', issued],
      ];
      doc.setFontSize(6);
      for (const [k, v] of rows) {
        doc.setTextColor(156, 163, 175);
        doc.setFont('helvetica', 'bold');
        doc.text(k, M, y);
        doc.setTextColor(55, 65, 81);
        doc.text(v, W - M, y, { align: 'right', maxWidth: W - M * 2 - 16 });
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.1);
        doc.line(M, y + 1.2, W - M, y + 1.2);
        y += 4.2;
      }

      // QR code.
      const qr = qrDataUrl();
      if (qr) {
        const q = 20;
        doc.addImage(qr, 'PNG', (W - q) / 2, y + 1, q, q);
        y += q + 3.5;
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text(qrValue, W / 2, y, { align: 'center', maxWidth: W - 6 });
      }

      // Footer.
      doc.setFillColor(250, 248, 243);
      doc.rect(0, H - 6, W, 6, 'F');
      doc.setTextColor(...R);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.text('DRINKSHARBOUR · PROPERTY OF THE COMPANY', W / 2, H - 2.2, {
        align: 'center',
      });

      doc.save(`badge-${code}.pdf`);
      toast.success('Badge downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build badge');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {/* When printing, hide the whole app and show only the badge card. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden !important; }
            #employee-badge-print, #employee-badge-print * { visibility: visible !important; }
            #employee-badge-print {
              position: fixed !important;
              left: 50% !important;
              top: 24px !important;
              transform: translateX(-50%) !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { margin: 12mm; }
          }`,
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Employee badge
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 px-5 py-6">
          <div
            id="employee-badge-print"
            className="mx-auto w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md print:shadow-none"
          >
            <div
              className="px-4 py-4 text-center text-white"
              style={{ background: BRAND }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-85">
                DrinksHarbour
              </p>
              <p className="mt-0.5 text-lg font-extrabold">Staff ID Card</p>
            </div>
            <div className="-mt-9 flex justify-center">
              {employee.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.avatar}
                  alt={name}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-white"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#b20202] ring-4 ring-white">
                  {initials(employee)}
                </div>
              )}
            </div>
            <div className="px-5 pb-5 pt-2 text-center">
              <p className="text-lg font-extrabold text-gray-900">{name}</p>
              <span className="mt-1 inline-block rounded-full bg-[#b20202]/10 px-3 py-0.5 text-[11px] font-bold text-[#b20202]">
                {role.label}
              </span>
              <div className="mt-3 text-left">
                <InfoRow label="Employee ID" value={code} />
                <InfoRow label="Badge / RFID" value={rfid} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Issued" value={issued} />
              </div>
              <div className="mt-4 flex flex-col items-center gap-1.5">
                <QRCodeCanvas
                  value={qrValue}
                  size={108}
                  level="M"
                  marginSize={1}
                />
                <code className="text-[10px] text-gray-400">{qrValue}</code>
              </div>
            </div>
            <div className="bg-[#faf8f3] py-2 text-center text-[9px] font-bold uppercase tracking-wider text-[#b20202]">
              DrinksHarbour · Property of the company
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <PiPrinterBold className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
          >
            <PiDownloadSimpleBold className="h-4 w-4" />
            {downloading ? 'Building…' : 'Download PDF'}
          </button>
        </div>
      </motion.div>

      {/* Hidden hi-res QR used to rasterise into the PDF / print window. */}
      <div className="pointer-events-none absolute -left-[9999px] top-0">
        <QRCodeCanvas
          ref={qrRef}
          value={qrValue}
          size={512}
          level="M"
          marginSize={2}
        />
      </div>
    </div>
  );
}
