# Research: B2 — RingCentral Connection Failure (CG Insurance + Jake)

**Status:** Investigation complete — ready for fix proposal
**Date:** 2026-03-29
**Bugs covered:** B2 (RC OAuth failure for CG + PSTN error, Jake's digital number hang)

---

## What Happened

### CG Insurance
1. Reached RC OAuth login page successfully
2. Saw notification: *"You cannot use this device to make PSTN calls including Emergency Calls since no Digital Line is associated."*
3. Clicked "Ok, got it" — page started loading and never completed
4. OAuth callback never returned to Lumina

### Jake Ridley
1. RC OAuth page prompted him to pick a digital number
2. Clicked one — nothing happened
3. Page stayed on the digital number selection screen
4. OAuth callback never returned to Lumina

---

## What the RC Docs Say (Official Sources)

**Source:** https://developers.ringcentral.com/guide/authentication/auth-code-flow
**Source:** https://developers.ringcentral.com/guide/basics/permissions
**Source:** https://community.ringcentral.com/developer-platform-apis-integrations-5/oauth-token-api-not-working-for-my-new-production-account-why-am-i-getting-thirdpartyappaccess-permission-required-error-7670

### PSTN notification is NOT an OAuth blocker
The "no Digital Line" message is a PSTN calling warning — it is unrelated to OAuth authorization. Dismissing it should not affect the redirect back to Lumina. It is a symptom of the RC account not having a Digital Line assigned, not a cause of the OAuth hang.

### The real requirement: `[ThirdPartyAppAccess]` permission
RingCentral requires this specific role permission to be enabled for any user authorizing a third-party app via OAuth. Without it, the token exchange fails. This must be enabled in the RingCentral Online Account Portal under the user's assigned role.

### What should happen after authorization
After the user authorizes, RC performs an HTTP 302 redirect to Lumina's `redirect_uri` with `?code=xxx&state=xxx`. If this redirect never fires, something in the RC account setup is blocking it.

### RC can send error params in the callback
RC may return `?error=access_denied` or similar in the callback URL instead of `?code=xxx`. Lumina's current callback handler does not read the `error` query param — it only checks for the absence of `code`, giving a generic "no_code" error with no useful detail.

---

## Root Cause Analysis

**Two separate problems:**

1. **RC account configuration (CG + Jake):** Their RC accounts likely lack the `[ThirdPartyAppAccess]` permission or have an incomplete Digital Line setup that prevents the OAuth redirect from completing. This is on the RC admin side — not a Lumina code issue.

2. **Lumina error handling gap:** When the OAuth flow fails or hangs, Lumina gives users no useful feedback:
   - If RC sends back `?error=access_denied`, Lumina shows a generic error with no explanation
   - If the callback never fires (Jake's case), the Settings page gives no feedback at all — it just sits there

---

## Proposed Fixes

### Fix 1 — RC account setup (support action, no code)
Ask CG and Jake to have their RC admin verify:
- `[ThirdPartyAppAccess]` permission is enabled in their user role
- A Digital Line is assigned to their RC account
- Account is in active state (not suspended/disabled)

### Fix 2 — Read RC error params in callback (backend)
In `/api/ringcentral/callback`, read `req.query.error` and `req.query.error_description` before checking for `code`. If RC sent an error, redirect to settings with the actual RC error message instead of a generic one.

```
/settings?ringcentral=error&message=<rc_error_description>
```

### Fix 3 — 45-second timeout on Settings page (frontend)
When the user clicks "Connect RingCentral" and is redirected to RC, start a 45-second timer on the Settings page. If the OAuth callback hasn't returned by then, show a message:

> "RingCentral connection timed out. If you're stuck on a screen in RingCentral, your account may need setup before connecting:
> - Ask your RC admin to enable **Third Party App Access** on your account
> - Make sure a **Digital Line** is assigned to your account in the RingCentral admin portal
> Then try connecting again."

45 seconds is enough time for a normal login. Any longer means something is hung.

---

## Recommended Build Order

1. **Fix 1 first** — support action, no code. Verify with CG and Jake before writing anything.
2. **Fix 2** — small backend change, captures RC error params for future debugging
3. **Fix 3** — frontend timeout, gives users actionable guidance when the flow hangs

---

## Open Questions
- What RC role are CG and Jake using? Admin or standard user?
- Has either of them had their RC admin check `[ThirdPartyAppAccess]`?
- Did Jake's digital number selection screen appear before or after he clicked "Authorize"?
