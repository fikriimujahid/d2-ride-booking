import { getRecord, getString, isRecord } from "../shared/typeGuards";

export function extractErrorMessageFromBody(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) return body;

  if (isRecord(body)) {
    const msg = getString(body.message);
    if (msg) return msg;

    if (Array.isArray(body.message)) {
      const joined = body.message
        .filter((x): x is string => typeof x === "string")
        .join("\n");
      if (joined) return joined;
    }

    const err = getRecord(body.error);
    const errMessage = err ? getString(err.message) : undefined;
    if (errMessage) return errMessage;

    const errCode = getString(body.error);
    if (errCode) return errCode;
  }

  return `Request failed with status ${status}`;
}
