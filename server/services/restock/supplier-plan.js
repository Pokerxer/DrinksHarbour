const { matchOffers, roundOrder, compareOffers } = require("./offers");
const { projectReplenishment } = require("./replenishment");
function attachSupplierPlan(line, e, { now, coverDays, leadTimes }) {
  line.alternatives = [];
  line.selected = null;
  if (!line.warehouseId) return;
  for (const offer of matchOffers(
    line,
    e.pricelists,
    e.tenantId,
    now,
    leadTimes,
  )) {
    const projection = projectReplenishment(
      line,
      line.forecast,
      line.incoming,
      offer.leadTimeDays,
      coverDays,
      now,
    );
    let reason = projection.manualReviewReason;
    const rounded = reason
      ? null
      : roundOrder(projection.suggestedUnits, offer);
    if (!reason && !rounded)
      reason =
        "Required units exceed this supplier quantity tier or maximum. Review a split order or another supplier.";
    if (!reason && line.incoming?.some((r) => r.source === "received_unposted"))
      reason =
        "Review received purchases awaiting stock posting before preparing another supplier order.";
    if (
      !reason &&
      line.incoming?.some((r) => r.source === "purchase_order" && !r.arrival)
    )
      reason =
        "Confirm pending purchase delivery dates before preparing a duplicate supplier order.";
    const quantity = reason ? 0 : rounded.quantity;
    line.alternatives.push({
      ...offer,
      urgency: projection.urgency,
      daysOfCover: projection.daysOfCover,
      stockoutDate: projection.stockoutDate,
      suggestedUnits: projection.suggestedUnits,
      incomingUnits: projection.incomingUnits,
      replenishment: projection,
      quantity,
      packs: quantity / offer.packagingQty,
      estimatedCost: Math.round(quantity * offer.unitPrice * 100) / 100,
      needsManualReview: !!reason,
      ...(reason
        ? {
            manualReviewReason: reason,
            purchaseAlternativeQuantity:
              rounded?.quantity ?? projection.suggestedUnits,
          }
        : {}),
    });
  }
  line.alternatives.sort((a, b) => compareOffers(a, b, e.currency || "NGN"));
  line.selected =
    line.alternatives.find((o) => o.currency === (e.currency || "NGN")) || null;
  if (line.selected && !line.selected.needsManualReview)
    Object.assign(line, {
      urgency: line.selected.urgency,
      suggestedUnits: line.selected.suggestedUnits,
      daysOfCover: line.selected.daysOfCover,
      stockoutDate: line.selected.stockoutDate,
    });
}
function reviewTransferSupply(line) {
  const t = line.transferPlan;
  if (
    !t ||
    t.needUnits <= 0 ||
    !["follow_up", "approval_review", "transfer_review"].includes(t.nextStep)
  )
    return;
  line.alternatives = line.alternatives.map((o) => ({
    ...o,
    purchaseAlternativeQuantity: o.purchaseAlternativeQuantity ?? o.quantity,
    quantity: 0,
    packs: 0,
    estimatedCost: 0,
    needsManualReview: true,
    manualReviewReason:
      "Review pending or recommended internal transfers before placing a supplier order.",
  }));
  line.selected =
    line.alternatives.find((o) => o.offerId === line.selected?.offerId) || null;
}
module.exports = { attachSupplierPlan, reviewTransferSupply };
