import { getApiBaseUrl } from "../config/apiBaseUrl";
import { extractErrorMessageFromBody } from "./errors";

const getAuthApiBase = () => getApiBaseUrl();

export async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getAuthApiBase()}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  const data: unknown = isJson
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    const message = extractErrorMessageFromBody(data, response.status);
    throw new Error(message);
  }

  return data as T;
}
