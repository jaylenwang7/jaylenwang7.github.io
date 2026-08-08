import { ApiError } from "./http";

const MAX_BODY_BYTES = 1024;
const SUBJECT_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSubjectId(value: string): string {
  if (!SUBJECT_ID.test(value)) {
    throw new ApiError(400, "bad_request", "The subject id is invalid.");
  }
  return value;
}

export function readVisitorId(request: Request, required: boolean): string | null {
  const value = request.headers.get("X-Visitor-Id");
  if (value === null) {
    if (required) {
      throw new ApiError(400, "bad_request", "A visitor id is required.");
    }
    return null;
  }
  if (!UUID_V4.test(value)) {
    throw new ApiError(400, "bad_request", "The visitor id is invalid.");
  }
  return value.toLowerCase();
}

export async function requireEmptyBody(request: Request): Promise<void> {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new ApiError(413, "payload_too_large", "The request body is too large.");
  }

  if (request.body === null) return;

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "payload_too_large", "The request body is too large.");
  }
  if (bytes.byteLength !== 0) {
    throw new ApiError(400, "bad_request", "This endpoint requires an empty body.");
  }
}

export function maxSubjects(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("MAX_SUBJECTS must be a positive integer");
  }
  return parsed;
}
