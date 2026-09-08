import { expect, test } from 'vitest';
import { runSearchRequest } from './search-request';
test('an older partial search cannot replace the latest full-name result', async () => {
  let finishOld!: (value: string[]) => void;
  const old = new AbortController();
  let displayed: string[] = [];
  const pending = runSearchRequest(
    () =>
      new Promise<string[]>((resolve) => {
        finishOld = resolve;
      }),
    old.signal,
    (items) => {
      displayed = items;
    }
  );
  old.abort();
  await runSearchRequest(
    async () => ['Glenfiddich'],
    new AbortController().signal,
    (items) => {
      displayed = items;
    }
  );
  finishOld([]);
  await pending;
  expect(displayed).toEqual(['Glenfiddich']);
});
test('failed requests expose an error instead of pretending there are no matches', async () => {
  let failure: string | undefined;
  await runSearchRequest(
    async () => {
      throw new Error('Service unavailable');
    },
    new AbortController().signal,
    (_, error) => {
      failure = error;
    }
  );
  expect(failure).toBe('Service unavailable');
});
test('clearing the search suppresses an in-flight error', async () => {
  const controller = new AbortController();
  controller.abort();
  let updates = 0;
  await runSearchRequest(
    async () => {
      throw Error('late');
    },
    controller.signal,
    () => {
      updates++;
    }
  );
  expect(updates).toBe(0);
});
