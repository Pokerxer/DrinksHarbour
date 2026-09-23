// A click may hand off its source once during client navigation. Never persist it.
let sourceId: string | null = null;

export function requestDuplicate(id: string): void {
  sourceId = id;
}

export function takeDuplicateSource(): string | null {
  const requested = sourceId;
  sourceId = null;
  return requested;
}
