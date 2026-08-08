export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly headers: HeadersInit | undefined;

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    headers?: HeadersInit,
  ) {
    super(publicMessage);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.headers = headers;
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: responseHeaders,
  });
}

export function fail(error: ApiError): Response {
  const headers = new Headers(error.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(
    JSON.stringify({
      ok: false,
      error: { code: error.code, message: error.publicMessage },
    }),
    { status: error.status, headers },
  );
}

export function internalFailure(): Response {
  return fail(
    new ApiError(500, "internal", "The interaction could not be processed."),
  );
}
