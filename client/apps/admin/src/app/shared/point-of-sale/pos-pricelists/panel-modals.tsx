'use client';

import React from 'react';
import type { PricelistRule, SubProductLite } from './types';
import ConfirmDialog from '@/app/shared/purchases/pricelists/confirm-dialog';
import CreateRuleModal from './create-rule-modal';

interface Props {
  products: SubProductLite[];
  showModal: boolean;
  editRule: PricelistRule | null;
  confirmRuleId: string | null;
  deleting: string | null;
  onCreateSave(payload: Record<string, unknown>): Promise<void>;
  onSaveNew(payload: Record<string, unknown>): Promise<void>;
  onCloseCreate(): void;
  onSaveEdit(ruleId: string, payload: Record<string, unknown>): Promise<void>;
  onCloseEdit(): void;
  onConfirmDelete(): void;
  onCancelDelete(): void;
}

/** Modals + confirm dialog for PricelistPanel. */
export default function PanelModals({
  products,
  showModal,
  editRule,
  confirmRuleId,
  deleting,
  onCreateSave,
  onSaveNew,
  onCloseCreate,
  onSaveEdit,
  onCloseEdit,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  return (
    <>
      {/* Create modal */}
      {showModal && (
        <CreateRuleModal
          products={products}
          onSave={onCreateSave}
          onSaveNew={onSaveNew}
          onDiscard={onCloseCreate}
        />
      )}

      {/* Edit modal — Save Changes + Cancel only */}
      {editRule && (
        <CreateRuleModal
          products={products}
          initialValues={editRule}
          onSave={(payload) => onSaveEdit(editRule._id, payload)}
          onDiscard={onCloseEdit}
        />
      )}

      {/* Delete-rule confirmation */}
      <ConfirmDialog
        open={!!confirmRuleId}
        title="Delete price rule?"
        message="This rule will be permanently removed from the pricelist."
        confirmLabel="Delete"
        tone="danger"
        busy={!!deleting}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
