const { id, key, DAY, dayStart } = require("./series");
const qty = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
const identity = (product, size, warehouse) => ({
  subProductId: id(product),
  sizeId: id(size),
  warehouseId: id(warehouse),
});
const netRows = (rows, returned) =>
  [...rows]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((row) => {
      const take = Math.min(row.units, returned);
      returned -= take;
      return { ...row, units: row.units - take };
    });
function transferDemand(e, now, historyStart) {
  const active = new Set(e.warehouses.map(id)),
    end = dayStart(now).getTime(),
    from = historyStart
      ? Math.min(+historyStart, end - 180 * DAY)
      : end - 180 * DAY;
  const rows = [],
    uncertain = new Set(),
    canonical = new Set(),
    documentReturns = new Map();
  const movements = (e.transferMovements || []).filter(
    (m) => id(m.tenant) === id(e.tenantId),
  );
  const returns = new Map(),
    byRef = new Map(),
    incomingGroups = new Map();
  const variantRef = (m) => `${id(m.subProduct)}:${id(m.size)}:${m.reference}`;
  const groupKey = (m) =>
    `${id(m.subProduct)}:${id(m.size)}:${m.transferGroupId ? `group:${id(m.transferGroupId)}` : `ref:${m.reference}`}`;
  for (const m of movements) {
    if (m.parentMovement) continue;
    const linked = byRef.get(variantRef(m)) || [];
    linked.push(m);
    byRef.set(variantRef(m), linked);
    if (m.type === "transfer_in") {
      const linkedIn = incomingGroups.get(groupKey(m)) || [];
      linkedIn.push(m);
      incomingGroups.set(groupKey(m), linkedIn);
    }
  }
  const byId = new Map(movements.map((m) => [id(m), m]));
  for (const m of movements) {
    const parent = byId.get(id(m.parentMovement));
    if (
      m.type === "transfer_out" &&
      m.parentMovement &&
      parent &&
      !parent.parentMovement &&
      id(parent.subProduct) === id(m.subProduct) &&
      id(parent.size) === id(m.size) &&
      ((parent.type === "transfer_in" &&
        id(parent.warehouse) === id(m.warehouse)) ||
        (parent.type === "transfer_out" &&
          id(parent.warehouse) !== id(m.warehouse))) &&
      Date.parse(m.createdAt) <= now.getTime()
    )
      returns.set(
        id(m.parentMovement),
        (returns.get(id(m.parentMovement)) || 0) + qty(m.quantity),
      );
  }
  const aliases = (t, k) =>
    [
      t.transferNumber && `Transfer ${t.transferNumber}`,
      t.transferNumber,
      id(t),
    ]
      .filter(Boolean)
      .map((ref) => `${k}:${ref}`);
  for (const t of e.transfers || []) {
    if (
      id(t.tenant) !== id(e.tenantId) ||
      !active.has(id(t.sourceWarehouse)) ||
      id(t.sourceWarehouse) === id(t.destinationWarehouse) ||
      !["completed", "partially_received", "in_transit"].includes(t.status)
    )
      continue;
    const grouped = new Map();
    (t.items || []).forEach((item, index) => {
      const base = identity(item.subProductId, item.sizeId, t.sourceWarehouse),
        k = key(base);
      const group = grouped.get(k) || {
        base,
        units: 0,
        returned: 0,
        events: [],
        valid: true,
      };
      const received = qty(item.receivedQty || item.transferredQty);
      group.units += received;
      group.returned += qty(item.returnedQty);
      if (t.receipts?.length) {
        const events = t.receipts.flatMap((receipt) =>
          (receipt.lines || [])
            .filter((l) => l.itemIndex === (item.receiptItemIndex ?? index))
            .map((l) => ({
              ...base,
              units: qty(l.quantity),
              at: receipt.receivedAt,
            })),
        );
        if (
          events.reduce((n, r) => n + r.units, 0) !== received ||
          events.some(
            (r) =>
              !Number.isFinite(Date.parse(r.at)) ||
              Date.parse(r.at) > now.getTime(),
          )
        )
          group.valid = false;
        group.events.push(...events);
      } else if (
        received &&
        t.status === "completed" &&
        Number.isFinite(Date.parse(t.completedDate)) &&
        Date.parse(t.completedDate) <= now.getTime()
      ) {
        group.events.push({ ...base, units: received, at: t.completedDate });
      } else if (received) group.valid = false;
      grouped.set(k, group);
    });
    for (const [k, group] of grouped) {
      const refs = aliases(t, k);
      const linked = refs.flatMap(
        (ref) =>
          byRef.get(
            `${group.base.subProductId}:${group.base.sizeId}:${ref.slice(k.length + 1)}`,
          ) || [],
      );
      const parentIds = new Set(
        linked
          .filter(
            (m) =>
              (m.type === "transfer_out" &&
                id(m.warehouse) === id(t.sourceWarehouse)) ||
              (m.type === "transfer_in" &&
                id(m.warehouse) === id(t.destinationWarehouse)),
          )
          .map(id),
      );
      const postedReturns = [...parentIds].reduce(
        (n, parent) => n + (returns.get(parent) || 0),
        0,
      );
      group.returned = Math.max(group.returned, postedReturns);
      if (group.valid && group.units) {
        refs.forEach((ref) => canonical.add(ref));
        rows.push(...netRows(group.events, group.returned));
      } else if (group.units) {
        const matches = linked.filter(
          (m) =>
            m.type === "transfer_out" &&
            id(m.warehouse) === group.base.warehouseId,
        );
        if (matches.reduce((n, m) => n + qty(m.quantity), 0) < group.units)
          uncertain.add(k);
        refs.forEach((ref) => documentReturns.set(ref, group.returned));
      }
    }
  }
  const ledgerGroups = new Map(),
    seen = new Set(),
    consumedParents = new Set();
  for (const out of movements) {
    if (
      out.type !== "transfer_out" ||
      out.parentMovement ||
      !active.has(id(out.warehouse)) ||
      !qty(out.quantity) ||
      !Number.isFinite(Date.parse(out.createdAt)) ||
      Date.parse(out.createdAt) > now.getTime()
    )
      continue;
    if (id(out) && seen.has(id(out))) continue;
    if (id(out)) seen.add(id(out));
    const base = identity(out.subProduct, out.size, out.warehouse),
      k = key(base),
      ref = `${k}:${out.reference}`;
    if (canonical.has(ref)) continue;
    const incoming = (incomingGroups.get(groupKey(out)) || []).filter(
      (m) => id(m.warehouse) !== id(out.warehouse),
    );
    let returned = 0;
    for (const parent of [out, ...incoming]) {
      const parentId = id(parent);
      if (consumedParents.has(parentId)) continue;
      returned += returns.get(parentId) || 0;
      consumedParents.add(parentId);
    }
    const group = ledgerGroups.get(ref) || { events: [], returned: 0 };
    group.events.push({ ...base, units: qty(out.quantity), at: out.createdAt });
    group.returned += returned;
    ledgerGroups.set(ref, group);
  }
  for (const [ref, group] of ledgerGroups)
    rows.push(
      ...netRows(
        group.events,
        Math.max(group.returned, documentReturns.get(ref) || 0),
      ),
    );
  return {
    rows: rows.filter(
      (r) => Date.parse(r.at) >= from && Date.parse(r.at) < end,
    ),
    uncertain,
  };
}
module.exports = { transferDemand };
