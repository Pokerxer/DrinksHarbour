// services/purchaseOrder.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** A warehouse as populated onto a PO by getPurchaseOrder (`name code` only). */
export interface POWarehouseRef {
  _id: string;
  name?: string;
  code?: string;
}

/**
 * Read a PO's destination warehouse id whether it came back populated or raw.
 * Exported so the create/edit/receipt screens all seed their picker the same way.
 */
export function warehouseIdOf(
  warehouse: string | POWarehouseRef | null | undefined
): string {
  if (!warehouse) return '';
  return typeof warehouse === 'string' ? warehouse : (warehouse._id ?? '');
}

/** The display label for a PO's destination, or '' when there is none. */
export function warehouseLabelOf(
  warehouse: string | POWarehouseRef | null | undefined
): string {
  if (!warehouse || typeof warehouse === 'string') return '';
  return warehouse.code
    ? `${warehouse.name} (${warehouse.code})`
    : (warehouse.name ?? '');
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  vendor?: string;
  vendorName?: string;
  vendorReference?: string;
  currency: string;
  confirmationDate?: string;
  expectedArrival?: string;
  arrivalDate?: string;
  /**
   * Standing destination for this order's goods. A string id when written, a
   * populated `{_id, name, code}` when read back from getPurchaseOrder. It seeds the
   * receipt screen's picker but does not lock it — each partial receipt records its
   * own warehouse, and that is what stock posts against.
   */
  warehouse?: string | POWarehouseRef | null;
  items: POItem[];
  notes?: string;
  status: string;
  tenant?: string;
  createdAt?: string;
  updatedAt?: string;
  // PO/RFQ common fields
  validUntil?: string;
  termsConditions?: string;
  originalPO?: string;
  isBackorder?: boolean;
  // Approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  // Lock/Unlock fields
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockReason?: string;
  // Agreement link
  purchaseAgreement?: string;
  agreementType?: 'blanket_order' | 'call_for_tender' | 'none';
  // Billing policy: bill on ordered or received quantities
  billControlPolicy?: 'ordered' | 'received';
}

export interface VendorResponse {
  vendorId?: string;
  vendorName: string;
  quoteDate?: string;
  totalAmount?: number;
  currency?: string;
  items?: {
    subProductId?: string;
    subProductName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    notes?: string;
  }[];
  notes?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  respondedAt?: string;
}

export interface POItem {
  subProductId: string;
  subProductName?: string;
  productName: string;
  sku: string;
  size?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  unitCost?: number;
  packPrice: number;
  receivedQty: number;
  // Receiving progress surfaced by getPurchaseOrder.
  orderedQty?: number;
  postedQty?: number;
  outstandingQty?: number;
  type: string;
  uom?: string;
  packagingQty?: number;
  packaging?: string;
  taxRate?: number;
  totalCost?: number;
  returnedQty?: number;
}

export interface PurchaseSettings {
  requirePOApproval: boolean;
  approvalThreshold: number;
  lockConfirmedOrders: boolean;
  defaultBillControlPolicy: 'ordered' | 'received';
  enable3WayMatching: boolean;
  autoGenerateBill: boolean;
  allowPartialReceipts: boolean;
  rfqValidityDays: number;
  defaultCurrency: 'NGN' | 'USD' | 'EUR' | 'GBP';
  defaultLeadTimeDays: number;
  defaultPaymentTerms: string;
  /** Free-text note, kept from before there was a picker. Not a Warehouse ref. */
  defaultReceivingLocation: string;
  /** Warehouse id seeding a new PO's destination; '' = none. */
  defaultReceivingWarehouse: string;
}

export interface CreatePOResponse {
  success: boolean;
  data: PurchaseOrder;
  message?: string;
}

export const purchaseOrderService = {
  async createPurchaseOrder(
    poData: any,
    token: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(poData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create purchase order');
    }

    return response.json();
  },

  async updatePurchaseOrderStatus(
    id: string,
    status: string,
    token: string,
    receivedItems?: {
      itemId: string;
      receivedQty: number;
      batchNumber?: string;
      expiryDate?: string;
    }[],
    warehouseId?: string
  ): Promise<CreatePOResponse> {
    const body = JSON.stringify({
      status,
      ...(receivedItems && { receivedItems }),
      ...(warehouseId && { warehouseId }),
    });

    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || 'Failed to update purchase order status'
      );
    }

    return response.json();
  },

  /**
   * Record a (partial) receipt against a PO. Quantities are ADDITIVE — each call
   * accumulates onto the line's receivedQty and appends a partial-receipt entry.
   * Stock is NOT posted here; posting happens when the PO is validated.
   */
  async receivePurchaseOrder(
    id: string,
    receiptLines: {
      itemId: string;
      receivedQty: number;
      batchNumber?: string;
      expiryDate?: string;
      sizeId?: string;
    }[],
    token: string,
    warehouseId?: string,
    notes?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/receive`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiptLines,
          ...(warehouseId && { warehouseId }),
          ...(notes && { notes }),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record receipt');
    }

    return response.json();
  },

  async generatePurchaseOrderReceipt(
    id: string,
    token: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/receipt`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate receipt');
    }

    return response.json();
  },

  async getPurchaseOrder(id: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch purchase order');
    }

    return response.json();
  },

  async getPurchaseOrders(token: string, params: any = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `${API_URL}/api/purchase-orders?${queryParams}`
      : `${API_URL}/api/purchase-orders`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(
          `Invalid response format from server. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }

        const errorText = await response.text();
        let errorMessage = 'Failed to fetch purchase orders';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          'Network error: Unable to connect to the server. Please check your internet connection and ensure the backend server is running.'
        );
      }
      throw error;
    }
  },

  /**
   * Fetches the *entire* purchase-order ledger by walking the server's
   * paginated list endpoint. Analytics must never silently cap at one page:
   * a plain `{ limit: N }` request drops everything past row N and skews every
   * total without any visible error. A hard page cap keeps a runaway
   * `totalPages` value from hammering the API; hitting it is reported via
   * `truncated` so callers can warn instead of lying.
   */
  async getAllPurchaseOrders(
    token: string,
    { pageSize = 500, maxPages = 20 }: { pageSize?: number; maxPages?: number } = {}
  ): Promise<{
    orders: PurchaseOrder[];
    totalCount: number;
    truncated: boolean;
  }> {
    const orders: PurchaseOrder[] = [];
    let totalPages = 1;
    let totalCount = 0;

    for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
      const response = await fetch(
        `${API_URL}/api/purchase-orders?page=${page}&limit=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        let message = 'Failed to fetch purchase orders';
        try {
          // ts-reset types response.json() as unknown — narrow explicitly.
          const err = (await response.json()) as { message?: string };
          if (err?.message) message = err.message;
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }
      const body = (await response.json()) as {
        data?: PurchaseOrder[];
        pagination?: { totalPages?: number; totalCount?: number };
      };
      const rows = Array.isArray(body.data) ? body.data : [];
      orders.push(...rows);
      totalPages =
        body.pagination?.totalPages && body.pagination.totalPages > 0
          ? body.pagination.totalPages
          : page;
      totalCount = body.pagination?.totalCount ?? orders.length;
      // Server signalled no more pages.
      if (rows.length === 0 || page >= totalPages) break;
    }

    return {
      orders,
      totalCount,
      truncated: totalPages > maxPages,
    };
  },

  async deletePurchaseOrder(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete purchase order');
    }

    return response.json();
  },

  async approvePO(
    id: string,
    token: string,
    notes?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve PO');
    }

    return response.json();
  },

  async rejectPO(
    id: string,
    token: string,
    notes?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject PO');
    }

    return response.json();
  },

  async lockPO(
    id: string,
    token: string,
    reason?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to lock PO');
    }

    return response.json();
  },

  async unlockPO(id: string, token: string): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/unlock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to unlock PO');
    }

    return response.json();
  },

  async createBillFromPO(
    id: string,
    token: string,
    options?: {
      billDate?: string;
      dueDate?: string;
      notes?: string;
      billControlPolicy?: 'ordered' | 'received';
    }
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/create-bill`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options || {}),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create bill from PO');
    }

    return response.json();
  },

  async updatePurchaseOrder(
    id: string,
    data: {
      vendor?: string;
      vendorName?: string;
      vendorReference?: string;
      currency?: string;
      expectedArrival?: string;
      items?: Partial<POItem>[];
      notes?: string;
      termsConditions?: string;
      validUntil?: string;
      purchaseAgreement?: string;
    },
    token: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(`${API_URL}/api/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update purchase order');
    }

    return response.json();
  },

  async returnPurchaseOrder(
    id: string,
    token: string,
    items: {
      subProductId: string;
      sizeId?: string;
      quantity: number;
      reason?: string;
    }[],
    notes?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/return`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items, notes }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to return purchase order items');
    }

    return response.json();
  },

  async getPurchaseSettings(token: string): Promise<{
    success: boolean;
    data: { purchaseSettings: PurchaseSettings };
  }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch purchase settings');
    }
    return response.json();
  },

  async updatePurchaseSettings(
    token: string,
    purchaseSettings: Partial<PurchaseSettings>
  ): Promise<{
    success: boolean;
    data: { purchaseSettings: PurchaseSettings };
  }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purchaseSettings }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update purchase settings');
    }
    return response.json();
  },

  async getSettings(token: string): Promise<{
    success: boolean;
    data: { purchaseSettings: PurchaseSettings };
  }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  async updateSettings(
    purchaseSettings: Partial<PurchaseSettings>,
    token: string
  ): Promise<{
    success: boolean;
    data: { purchaseSettings: PurchaseSettings };
    message?: string;
  }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purchaseSettings }),
    });
    return response.json();
  },

  async sendPOToVendor(
    id: string,
    token: string,
    email?: string
  ): Promise<CreatePOResponse> {
    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/send-to-vendor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send PO to vendor');
    }

    return response.json();
  },
};
