export type HttpErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export function httpError(statusCode: number, code: HttpErrorCode, message: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code
  });
}
