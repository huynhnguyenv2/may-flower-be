export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
  }
}

export function errorPayload(code: string, message: string, details?: unknown[]) {
  return {
    error: {
      code,
      message,
      details: details ?? [],
    },
  };
}
