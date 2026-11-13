// Every call from the attendance screen to the Express API goes through here.
// The API and the site share one server, so paths like /api/... need no host or port.

// The stub login: whichever user the picker has chosen is sent on every request.
// TODO(FP-1): replace this with a real session or token.
let currentUserId = 2;

export function setCurrentUserId(id) {
  currentUserId = id;
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-user-id': String(currentUserId),
      ...options.headers,
    },
  });

  // The API answers errors as { error: "message" }. The fallback covers a reply that isn't JSON.
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
