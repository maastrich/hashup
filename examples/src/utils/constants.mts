export const API_VERSION = "v1";
export const MAX_RETRIES = 3;
export const TIMEOUT_MS = 5000;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;
