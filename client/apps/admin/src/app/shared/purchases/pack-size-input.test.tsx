// app/shared/purchases/pack-size-input.test.tsx
// @vitest-environment jsdom
// When an operator edits a line's Pack Size, that new value becomes the
// size's default packaging quantity. The commit happens on blur / Enter —
// never per keystroke (typing "24" must not fire two server writes).
import { useEffect, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import PackSizeInput from './pack-size-input';

afterEach(cleanup);

/** The real forms control the pack size via onApply — a stateless mock would
 *  leave the value stale and no commit would ever fire. */
function Harness(props: {
  initial: number;
  onApply: (p: { packSize: number; uom?: string }) => void;
  onCommitDefault?: (v: number) => void;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(props.initial);
  useEffect(() => setValue(props.initial), [props.initial]);
  return (
    <SessionProvider session={{ user: { token: 'tok' } } as never}>
      <PackSizeInput
        value={value}
        onApply={(p) => {
          props.onApply(p);
          setValue(p.packSize);
        }}
        onCommitDefault={props.onCommitDefault}
      />
    </SessionProvider>
  );
}

const renderField = (props: {
  value: number;
  onCommitDefault?: (v: number) => void;
}) => {
  const onApply = vi.fn();
  const view = render(
    <Harness initial={props.value} onApply={onApply} onCommitDefault={props.onCommitDefault} />,
  );
  const input = view.container.querySelector('input[type="number"]') as HTMLInputElement;
  return { input, onApply };
};

describe('PackSizeInput default packaging commit', () => {
  it('commits the edited pack size on blur', () => {
    const onCommitDefault = vi.fn();
    const { input } = renderField({ value: 12, onCommitDefault });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    // No commit while still typing/focused.
    expect(onCommitDefault).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommitDefault).toHaveBeenCalledExactlyOnceWith(6);
  });

  it('commits on Enter too', () => {
    const onCommitDefault = vi.fn();
    const { input } = renderField({ value: 12, onCommitDefault });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitDefault).toHaveBeenCalledExactlyOnceWith(8);
  });

  it('does not commit when the value is unchanged', () => {
    const onCommitDefault = vi.fn();
    const { input } = renderField({ value: 12, onCommitDefault });
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onCommitDefault).not.toHaveBeenCalled();
  });

  it('does not commit sub-1 values', () => {
    const onCommitDefault = vi.fn();
    const { input } = renderField({ value: 12, onCommitDefault });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(onCommitDefault).not.toHaveBeenCalled();
  });

  it('re-commits after a second edit in the same field', () => {
    const onCommitDefault = vi.fn();
    const { input } = renderField({ value: 12, onCommitDefault });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(onCommitDefault).toHaveBeenLastCalledWith(9);
  });
});
