'use client';

import { useState, useCallback } from 'react';
import type {
  LineRow,
  GroupRow,
  LineExportCol,
  GroupExportCol,
  SalesSummary,
  StatusFilter,
} from '../types';
import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS } from '../constants';
import { exportLineCsv, exportGroupedCsv } from '../export/csv';
import { exportLineExcel, exportGroupedExcel } from '../export/excel';
import { exportLinePdf } from '../export/pdf-line';
import { exportGroupedPdf } from '../export/pdf-group';

interface UseSalesExportParams {
  sorted: LineRow[];
  grouped: GroupRow[];
  groupLabel: string;
  hasCostData: boolean;
  showProfit: boolean;
  viewMode: 'lines' | 'grouped';
  summary: SalesSummary;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  cashierFilter: string;
  methodFilter: string;
  statusFilter: StatusFilter;
  storeName: string;
}

export function useSalesExport(params: UseSalesExportParams) {
  const [showExport, setShowExport] = useState(false);
  const [exportDialog, setExportDialog] = useState({
    open: false,
    format: 'csv' as 'csv' | 'excel' | 'pdf',
    lineCols: new Set(
      LINE_EXPORT_COLS.map((c) => c.key)
    ) as Set<LineExportCol>,
    groupCols: new Set(
      GROUP_EXPORT_COLS.map((c) => c.key)
    ) as Set<GroupExportCol>,
  });

  const handleExport = useCallback((fmt: 'csv' | 'excel' | 'pdf') => {
    setShowExport(false);
    setExportDialog((prev) => ({ ...prev, open: true, format: fmt }));
  }, []);

  const toggleExportLineCol = useCallback((key: LineExportCol) => {
    if (LINE_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.lineCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, lineCols: next };
    });
  }, []);

  const toggleExportGroupCol = useCallback((key: GroupExportCol) => {
    if (GROUP_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.groupCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, groupCols: next };
    });
  }, []);

  const selectAllExportCols = useCallback(() => {
    const hc = params.hasCostData && params.showProfit;
    if (params.viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(
          GROUP_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)
        ),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(
          LINE_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)
        ),
      }));
    }
  }, [params.hasCostData, params.showProfit, params.viewMode]);

  const deselectAllExportCols = useCallback(() => {
    if (params.viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(
          GROUP_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)
        ),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(
          LINE_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)
        ),
      }));
    }
  }, [params.viewMode]);

  const confirmExport = useCallback(() => {
    const hasCost = params.hasCostData && params.showProfit;
    const pdfMeta = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      timeFrom: params.timeFrom,
      timeTo: params.timeTo,
      cashierFilter: params.cashierFilter,
      methodFilter: params.methodFilter,
      statusFilter: params.statusFilter,
      storeName: params.storeName,
      summary: params.summary,
    };
    const { format: fmt, lineCols, groupCols } = exportDialog;
    setExportDialog((prev) => ({ ...prev, open: false }));
    if (params.viewMode === 'grouped') {
      if (fmt === 'csv') exportGroupedCsv(params.grouped, params.groupLabel, groupCols);
      if (fmt === 'excel') exportGroupedExcel(params.grouped, params.groupLabel, groupCols);
      if (fmt === 'pdf')
        exportGroupedPdf(params.grouped, params.groupLabel, hasCost, pdfMeta, groupCols);
    } else {
      if (fmt === 'csv') exportLineCsv(params.sorted, lineCols);
      if (fmt === 'excel') exportLineExcel(params.sorted, lineCols);
      if (fmt === 'pdf') exportLinePdf(params.sorted, hasCost, pdfMeta, lineCols);
    }
  }, [params, exportDialog]);

  return {
    showExport,
    setShowExport,
    exportDialog,
    setExportDialog,
    handleExport,
    confirmExport,
    toggleExportLineCol,
    toggleExportGroupCol,
    selectAllExportCols,
    deselectAllExportCols,
  };
}