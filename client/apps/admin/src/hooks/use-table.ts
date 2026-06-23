export function useTable() {
  return {
    getRowProps: () => ({}),
    getCellProps: () => ({}),
    rows: [],
    prepareRow: () => {},
  };
}
