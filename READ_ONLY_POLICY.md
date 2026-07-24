# Read-Only Policy

**This dashboard reads advertising data. It never writes, modifies, pauses,
creates, or deletes anything — on Meta or Google Ads — regardless of which
account is connected or who connects it.**

This is not a convention or a code-review habit. It is enforced at four
independent layers, each sufficient on its own.

---

## Layer 1 — Permission scope (strongest)

`app/api/auth/meta/login/route.js` requests only:

- `ads_read` — read campaigns, ads, insights
- `business_management` — enumerate business portfolios and their ad accounts

**`ads_management` is deliberately never requested.** That is the Meta
permission which grants create / edit / pause / delete on campaigns, ad sets
and ads. Because a connected user never grants it, the resulting access token
is *physically incapable* of mutating ad data.

This layer holds even if every other check in this repository were deleted, or
if the code were modified maliciously. Meta itself refuses the write.

The same applies to Google Ads: mutations there require the `*:mutate`
endpoints, which this codebase never calls.

## Layer 2 — HTTP method

`app/api/meta/route.js` exports `GET` for reads, and explicitly exports
`POST`, `PUT`, `PATCH` and `DELETE` as handlers that always return **405 Method
Not Allowed**. They are declared rather than merely omitted, so refusing writes
is a deliberate contract rather than an accident of what happens to be exported.

## Layer 3 — Endpoint allowlist

Only Graph API paths matching an explicit read-only allowlist are proxied.
Patterns are anchored at both ends (`^...$`) so a crafted path cannot smuggle
extra segments past the check. Anything unrecognised returns **403**.

For Google Ads, the query must be a bare `SELECT` against an allowlisted
resource, containing no `;` (no statement chaining) and none of the mutation
keywords `MUTATE / INSERT / UPDATE / DELETE / CREATE / DROP / ALTER / REMOVE /
GRANT / REVOKE / EXEC`.

## Layer 4 — Upstream request construction

The outbound call to Graph hardcodes `method: 'GET'`. Parameters that could
carry a mutation payload or override credentials are stripped before
forwarding: `access_token`, `token`, `method`, `batch`, `body`,
`include_headers`, `relative_url`.

There is deliberately **no caller-supplied token override**. Tokens are
resolved server-side from the connection that owns the requested account, so
this endpoint cannot be used to proxy arbitrary credentials.

---

## If write access is ever genuinely needed

Do not add it to this proxy. Build a separate service with its own
separately-scoped credentials, its own audit logging, and its own
authorisation model. Keeping the read path incapable of writing is the entire
point of the design.

## Reviewer checklist

Any change touching `app/api/meta/`, `app/api/google-ads/`, or
`app/api/auth/*/login/` should be checked against:

- [ ] No new scope requested beyond `ads_read` / `business_management`
- [ ] `ads_management` still absent
- [ ] No new exported HTTP method beyond `GET` (except the 405 handlers)
- [ ] Any new allowlist entry is a read endpoint, anchored `^...$`
- [ ] `method: 'GET'` still hardcoded on the upstream fetch
- [ ] `BLOCKED_PARAMS` still strips credential and mutation parameters
