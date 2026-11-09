export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function routeParam(value: string | string[] | undefined): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new HttpError(400, 'Missing id');
  return resolved;
}
