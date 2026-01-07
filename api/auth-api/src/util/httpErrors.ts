export function httpError(statusCode: number, message: string, code?: string) {
  return Object.assign(new Error(message), { statusCode, code });
}
