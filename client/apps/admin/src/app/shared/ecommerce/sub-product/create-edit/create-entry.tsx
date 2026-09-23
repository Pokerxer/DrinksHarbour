'use client';

import { useEffect, useRef, useState } from 'react';
import CreateEditSubProduct from './index';
import DuplicateSubProductCreate from './duplicate-create';
import { takeDuplicateSource } from './duplicate-intent';

export default function SubProductCreateEntry() {
  const consumed = useRef(false);
  const [sourceId, setSourceId] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    // Strict Mode replays effects; consume the click only once per mount.
    if (consumed.current) return;
    consumed.current = true;
    setSourceId(takeDuplicateSource());
  }, []);

  if (sourceId === undefined) return <p role="status">Opening form…</p>;
  if (sourceId) {
    return (
      <DuplicateSubProductCreate
        sourceId={sourceId}
        onStartBlank={() => setSourceId(null)}
      />
    );
  }
  return <CreateEditSubProduct />;
}
