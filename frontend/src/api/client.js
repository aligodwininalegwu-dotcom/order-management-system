// Central place for talking to the backend. Every page imports from here
// instead of calling fetch() directly, so the base URL, auth header, and
// error handling only exist in one place.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT_MS = 20000;

/** Error thrown for any failed request, carrying the HTTP status when known. */
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Lets the auth layer react to an expired session without this module
// importing React code (which would create a circular dependency).
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

/**
 * Wraps fetch with the API base URL, JSON handling, a timeout, and
 * automatic attachment of the saved JWT (if one exists) as an
 * Authorization header.
 */
async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? localStorage.getItem('token') : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (error.name === 'AbortError' && signal?.aborted) throw error; // caller cancelled
    throw new ApiError(
      error.name === 'TimeoutError'
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.'
    );
  }

  // Error responses from a proxy or crashed server may not be JSON.
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or invalid token on an authenticated call means the session is over.
    if (response.status === 401 && token && onUnauthorized) onUnauthorized();
    // The backend's errorHandler always sends { success: false, message }
    throw new ApiError(data?.message || 'Something went wrong', response.status);
  }

  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
