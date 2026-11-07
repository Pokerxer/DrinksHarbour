/** Explicit JSON boundary. Callers supply the endpoint's response contract;
 * untyped callers keep unknown rather than silently opting out of checking. */
export async function readJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readError(response: Response): Promise<{ message?: string }> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
    ? { message: body.message }
    : {};
}
