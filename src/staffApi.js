// Every call from the staff screens (attendance, eligibility) to the Express API goes through here.
// The API and the site share one server, so paths like /api/... need no host or port, and the
// browser sends the login cookie with each request.

export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  // The API answers errors as { error: "message" }. The fallback covers a reply that isn't JSON.
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
