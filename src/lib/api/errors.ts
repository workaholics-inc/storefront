export type ErrorBody = { error: { code: string; message: string } };

export function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export type PlatformResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string };

// Run one platform call and fold every outcome into a PlatformResult. Build the
// client inside `run`, so a configuration error becomes "unreachable" here
// instead of escaping as an exception.
export async function platformCall<T>(
  run: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<PlatformResult<T>> {
  try {
    const { data, error, response } = await run();
    if (response.ok) {
      return { ok: true, status: response.status, data: data as T };
    }

    return {
      ok: false,
      status: response.status,
      code: isErrorBody(error) ? error.error.code : "internal_error",
    };
  } catch (thrown) {
    // The message only: request data must never reach the log.
    console.error(
      thrown instanceof Error ? thrown.message : "platform call failed",
    );
    return { ok: false, status: 0, code: "unreachable" };
  }
}
