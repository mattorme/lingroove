export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// Base URL for static assets (avatars, etc.) — strip the /api/v1 suffix.
export const STATIC_BASE = API_BASE.replace(/\/api\/v1\/?$/, "");
