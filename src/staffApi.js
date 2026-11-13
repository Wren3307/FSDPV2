// Every call from the staff screens (attendance, eligibility) to the Express API goes through here.
// The API and the site share one server, so paths like /api/... need no host or port.

// The stub login: whichever user the picker has chosen is sent on every request.
// It's kept in sessionStorage so moving between /attendance and /eligibility keeps the same user.
// TODO(FP-1): replace this with a real session or token.
export function getCurrentUserId() {
  try {
    return Number(sessionStorage.getItem('demoUserId')) || 2; // default: Kenji, instructor at Shinjuku
  } catch {
    return 2; // storage can be blocked (e.g. private mode); fall back to the default
  }
}

export function setCurrentUserId(id) {
  try {
    sessionStorage.setItem('demoUserId', String(id));
  } catch {
    // Not saved, so a page change goes back to the default user. The current page still works.
  }
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-user-id': String(getCurrentUserId()),
      ...options.headers,
    },
  });

  // The API answers errors as { error: "message" }. The fallback covers a reply that isn't JSON.
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
