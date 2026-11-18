export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function token(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("mm-token") || "";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || payload.error || "Request failed");
  return payload as T;
}
