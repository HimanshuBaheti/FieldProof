export class ApiError extends Error {
  constructor(message: string, public logs?: string[]) {
    super(message);
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new ApiError(data.error ?? `HTTP ${res.status}`, data.logs);
  return data as T;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
