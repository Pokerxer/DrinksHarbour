const { id, DAY } = require('./series');
const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
function outstanding(transfer, item) {
  const modern = transfer.dispatchedAt || transfer.receipts?.length;
  const committed =
    transfer.status === 'confirmed' || modern || !num(item.transferredQty)
      ? num(item.quantity)
      : num(item.transferredQty);
  return Math.max(
    0,
    committed - num(item.receivedQty) - num(item.shortfallQty),
  );
}
function transferEvidence(e, now) {
  const active = new Set(e.warehouses.map(id)),
    from = now.getTime() - 180 * DAY,
    history = [],
    pending = [];
  const valid = (source, destination) =>
    source &&
    destination &&
    source !== destination &&
    active.has(source) &&
    active.has(destination);
  for (const t of e.transfers || []) {
    if (id(t.tenant) !== id(e.tenantId)) continue;
    const source = id(t.sourceWarehouse),
      destination = id(t.destinationWarehouse);
    if (!valid(source, destination)) continue;
    for (const item of t.items || []) {
      const base = {
        subProductId: id(item.subProductId),
        sizeId: id(item.sizeId),
        sourceWarehouseId: source,
        destinationWarehouseId: destination,
        transferId: id(t),
        reference: t.transferNumber || id(t),
        status: t.status,
      };
      if (
        [
          'confirmed',
          'in_transit',
          'partially_received',
          'pending_approval',
        ].includes(t.status)
      ) {
        const quantity =
          t.status === 'pending_approval'
            ? Math.max(
                0,
                num(item.quantity) -
                  num(item.receivedQty) -
                  num(item.shortfallQty),
              )
            : outstanding(t, item);
        if (quantity > 0)
          pending.push({
            ...base,
            quantity,
            arrival: null,
            dispatchedAt: t.dispatchedAt || null,
            scheduledDate: t.scheduledDate || null,
          });
      }
      if (t.status !== 'completed') continue;
      const at = Date.parse(t.completedDate);
      const quantity = Math.max(
        0,
        num(item.receivedQty ?? item.transferredQty) - num(item.returnedQty),
      );
      if (!quantity || !Number.isFinite(at) || at < from || at > now.getTime())
        continue;
      const dispatched = Date.parse(t.dispatchedAt);
      history.push({
        ...base,
        quantity,
        at: new Date(at).toISOString(),
        transitDays:
          Number.isFinite(dispatched) && at >= dispatched
            ? Math.max(1, Math.ceil((at - dispatched) / DAY))
            : null,
      });
    }
  }
  const movements = (e.transferMovements || []).filter(
    (m) => id(m.tenant) === id(e.tenantId),
  );
  const returns = new Map(),
    groups = new Map();
  for (const m of movements) {
    if (m.parentMovement && m.type === 'transfer_out')
      returns.set(
        id(m.parentMovement),
        (returns.get(id(m.parentMovement)) || 0) + num(m.quantity),
      );
    if (m.parentMovement || !m.transferGroupId) continue;
    const k = `${id(m.transferGroupId)}:${id(m.subProduct)}:${id(m.size)}`,
      group = groups.get(k) || [];
    group.push(m);
    groups.set(k, group);
  }
  for (const group of groups.values()) {
    const outs = group.filter((m) => m.type === 'transfer_out'),
      ins = group.filter((m) => m.type === 'transfer_in');
    if (outs.length !== 1 || ins.length !== 1) continue;
    const out = outs[0],
      incoming = ins[0],
      source = id(out.warehouse),
      destination = id(incoming.warehouse),
      at = Date.parse(incoming.createdAt);
    const quantity = Math.max(
      0,
      Math.min(num(out.quantity), num(incoming.quantity)) -
        (returns.get(id(incoming)) || 0),
    );
    if (
      !valid(source, destination) ||
      !quantity ||
      !Number.isFinite(at) ||
      at < from ||
      at > now.getTime()
    )
      continue;
    history.push({
      subProductId: id(incoming.subProduct),
      sizeId: id(incoming.size),
      sourceWarehouseId: source,
      destinationWarehouseId: destination,
      quantity,
      at: new Date(at).toISOString(),
      transferId: id(incoming.transferGroupId),
      reference: incoming.reference || 'Direct warehouse transfer',
      transitDays: null,
    });
  }
  return { history, pending };
}
module.exports = { outstanding, transferEvidence };
