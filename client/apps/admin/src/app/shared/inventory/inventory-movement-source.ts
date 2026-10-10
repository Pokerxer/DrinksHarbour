export function movementSourceLabel(source: string) {
  return (
    (
      { pos: 'POS', api: 'API', system: 'System', manual: 'Manual', order: 'Order' } as Record<
        string,
        string
      >
    )[source] ||
    source ||
    '—'
  );
}
