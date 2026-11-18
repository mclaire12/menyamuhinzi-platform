export const AI_URL = process.env.AI_URL || "http://localhost:8000";

export async function ai(path: string, body?: unknown, method = "POST"): Promise<any> {
  const response = await fetch(`${AI_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.detail || "AI service unavailable");
    (error as any).status = response.status;
    throw error;
  }
  return payload;
}
