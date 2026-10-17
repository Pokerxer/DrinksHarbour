'use client';
import { useEffect, useRef, useState, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  PiCaretRight,
  PiChartLineUp,
  PiCopy,
  PiEnvelope,
  PiGear,
  PiLink,
  PiFolderSimplePlus,
  PiPaperPlaneTilt,
  PiPencilSimple,
  PiPrinter,
  PiShareNetwork,
  PiTag,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { salesOrderService } from '@/services/salesOrder.service';
export default function SalesCreateMoreActions({
  orderId,
  token,
  disabled,
  onPrint,
  onSendProForma,
  onStatusChange,
  readOnly = false,
}: {
  orderId?: string;
  token: string;
  disabled?: boolean;
  onPrint?: () => void;
  onSendProForma?: () => void;
  onStatusChange?: () => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const handleDuplicate = async () => {
    if (!orderId) {
      toast('No order to duplicate');
      return;
    }
    try {
      const res = await salesOrderService.duplicate(orderId, token);
      toast('Order duplicated');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch {
      toast('Failed to duplicate order');
    }
  };

  const handleMarkAsSent = async () => {
    if (!orderId) {
      toast('No order to mark');
      return;
    }
    try {
      await salesOrderService.send(orderId, token);
      toast('Marked as sent');
      onStatusChange?.();
    } catch {
      toast('Failed to mark as sent');
    }
  };

  const handleGeneratePaymentLink = async () => {
    if (!orderId) {
      toast('No order selected');
      return;
    }
    try {
      const res = await salesOrderService.generatePaymentLink(orderId, token);
      window.open(res.data.paymentLink, '_blank');
      toast('Payment link generated');
    } catch {
      toast('Failed to generate payment link');
    }
  };

  const handleAccruedRevenueEntry = async () => {
    if (!orderId) {
      toast('No order selected');
      return;
    }
    try {
      await salesOrderService.accruedRevenue(orderId, token);
      toast('Accrued revenue entry created');
    } catch {
      toast('Failed to create accrued revenue entry');
    }
  };

  const handleRequestSignature = async () => {
    if (!orderId) {
      toast('No order selected');
      return;
    }
    try {
      await salesOrderService.requestSignature(orderId, token);
      toast('Signature request sent');
    } catch {
      toast('Failed to request signature');
    }
  };

  const handleSendEmail = async () => {
    if (!orderId) {
      toast('No order selected');
      return;
    }
    try {
      await salesOrderService.sendEmail(orderId, token);
      toast('Email sent');
    } catch {
      toast('Failed to send email');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link copied to clipboard');
    } catch {
      toast('Failed to copy link');
    }
  };

  const handleCreateProject = async () => {
    if (!orderId) {
      toast('No order selected');
      return;
    }
    try {
      await salesOrderService.createProject(orderId, token);
      toast('Project created');
    } catch {
      toast('Failed to create project');
    }
  };

  // Gear dropdown state
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node))
        setGearOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function gearItem(
    action: (() => void) | undefined,
    label: string,
    Icon: ElementType,
    hasArrow?: boolean
  ) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          action?.();
          setGearOpen(false);
        }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 text-left">{label}</span>
        {hasArrow && <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />}
      </button>
    );
  }

  return (
    <div ref={gearRef} className="relative">
      <button
        type="button"
        onClick={() => setGearOpen((v) => !v)}
        title="More actions"
        aria-label="More actions"
        aria-expanded={gearOpen}
        disabled={disabled}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <PiGear className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </button>

      {gearOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {gearItem(onPrint, 'Print', PiPrinter, true)}
          {gearItem(onSendProForma, 'Print pro forma', PiPaperPlaneTilt)}
          {!readOnly && gearItem(
            handleRequestSignature,
            'Request Signature',
            PiPencilSimple
          )}
          {gearItem(handleDuplicate, 'Duplicate', PiCopy)}
          <div className="my-1 border-t border-gray-100" />
          {gearItem(
            handleAccruedRevenueEntry,
            'Accrued Revenue Entry',
            PiChartLineUp
          )}
          {gearItem(
            handleGeneratePaymentLink,
            'Generate a Payment Link',
            PiLink
          )}
          {gearItem(handleSendEmail, 'Send an email', PiEnvelope)}
          {!readOnly && gearItem(handleMarkAsSent, 'Mark Quotation as Sent', PiTag)}
          {gearItem(handleShare, 'Share', PiShareNetwork)}
          {gearItem(handleCreateProject, 'Create Project', PiFolderSimplePlus)}
        </div>
      )}
    </div>
  );
}
