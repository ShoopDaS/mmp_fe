# Spotify Login Design

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Add "Login with Spotify" to the main login screen, with Spotify auto-connected as a music platform upon login. Designed to be extended with SoundCloud login later.

---

## Background

Unison currently supports Google OAuth as the only login method. Spotify and SoundCloud are connected separately as music platforms after login. Users have requested logging in directly with Spotify, and the design must accommodate SoundCloud login being added later with minimal duplication.

---

## Goals

- Add a "Login with Spotify" button to the main login screen
- On successful Spotify login, automatically mark Spotify as a connected music platform (no second OAuth step)
- Keep the shared dual-role pattern (auth + auto-platform-connect) DRY for future SoundCloud login
- No change to existing Google login flow

---

## Architecture

### Core Pattern: `find_or_create_user_with_platform()`

A new method on `BaseAuthHandler` encapsulates the dual-write that occurs when a streaming platform is also used as a login provider:

1. Call `find_or_create_user()` → writes `PROFILE` + `auth#{provider}` items
2. Call `BasePlatformHandler(provider).store_platform_tokens()` → writes `platform#{provider}` item
3. Return `user_id`

Both `handlers/auth/spotify.py` and future `handlers/auth/soundcloud.py` call this one method. Each auth handler is thin — it only contains OAuth URL construction, scope definitions, and provider-specific user-info field parsing.

### Scopes

The Spotify auth login requests the full platform scope set (same as the existing platform connect flow):

```
user-read-private user-read-email streaming user-modify-playback-state
user-read-playback-state user-library-read user-library-modify
playlist-read-private playlist-modify-private playlist-modify-public
```

This ensures `platform#spotify` is created with complete playback permissions in a single OAuth round-trip.

### Redirect URI

A new environment variable `SPOTIFY_AUTH_REDIRECT_URI` points to `/auth/spotify/callback`. This is separate from the existing `SPOTIFY_REDIRECT_URI` (used by `/platforms/spotify/callback`). Both use the same `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — the Spotify app just needs both URIs registered.

---

## DynamoDB

On a Spotify login, three items are written under the same `userId`:

| SK | Contents | Purpose |
|---|---|---|
| `PROFILE` | email, displayName, `primaryAuthProvider: "spotify"` | User identity |
| `auth#spotify` | providerId (Spotify user ID), email, linked, linkedAt | Login lookup key |
| `platform#spotify` | platformUserId, accessToken (encrypted), refreshToken (encrypted), scope | Music playback tokens |

The existing `get_user_by_provider(provider, provider_id)` scan is used for the auth lookup — consistent with the existing Google auth implementation. A GSI should be added in production for both `auth#` and `platform#` lookups.

---

## Backend Changes

### New: `src/handlers/auth/spotify.py`

- `login_handler` — builds Spotify OAuth URL with full scopes, returns `authUrl`
- `callback_handler` — exchanges code, fetches `/v1/me`, calls `auth_handler.find_or_create_user_with_platform()`, creates session JWT, redirects to `FRONTEND_URL?session={token}`
- `exchange_code_for_token(code)` — uses `SPOTIFY_AUTH_REDIRECT_URI`
- `get_spotify_user_info(access_token)` — identical to the one in `handlers/platforms/spotify.py`; can be imported from there

### Modified: `src/handlers/auth/base.py`

Add `find_or_create_user_with_platform()`:

```python
def find_or_create_user_with_platform(
    self,
    provider_id: str,
    email: str,
    display_name: str,
    access_token: str,
    refresh_token: str,
    expires_in: int,
    platform_user_id: str,
    scope: str = '',
    avatar_url: Optional[str] = None
) -> str:
    user_id = self.find_or_create_user(provider_id, email, display_name, avatar_url)
    platform_handler = BasePlatformHandler(self.provider_name)
    platform_handler.store_platform_tokens(
        user_id=user_id,
        platform_user_id=platform_user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        scope=scope
    )
    return user_id
```

### Modified: `main.py`

Add two new routes:

```python
POST /auth/spotify/login    → spotify_auth.login_handler
GET  /auth/spotify/callback → spotify_auth.callback_handler
```

### New Environment Variable

```
SPOTIFY_AUTH_REDIRECT_URI=http://127.0.0.1:8080/auth/spotify/callback
```

---

## Frontend Changes

### Modified: `src/lib/api.ts`

Add `spotifyLogin()` method:

```typescript
async spotifyLogin() {
  return this.request<{ authUrl: string; state: string }>('/auth/spotify/login', {
    method: 'POST',
  });
}
```

### Modified: `src/components/auth/ProviderButton.tsx`

Add `'spotify'` as a supported provider with Spotify green styling and `SpotifyIcon`.

### Modified: `src/components/auth/LoginSection.tsx`

Add `handleSpotifyLogin` (mirrors `handleGoogleLogin`). Add `<ProviderButton provider="spotify" />` below the Google button.

### Unchanged

- `src/app/page.tsx` — already handles `?session=` and `?error=` params from any provider
- `src/app/profile/page.tsx` — already displays `platform#spotify` when present; Spotify will appear as connected automatically
- `src/contexts/AuthContext.tsx` — no changes needed
- `src/contexts/HubContext.tsx` — no changes needed

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Returning Spotify user logs in again | `find_or_create_user()` finds existing `auth#spotify` → same userId returned. `store_platform_tokens()` overwrites with fresh tokens. |
| User logs in via Spotify, then clicks "Connect Spotify" on profile | `platform#spotify` already exists; `put_item` overwrites → tokens refreshed. No error. |
| User disconnects Spotify platform (keeps auth#spotify) | Auth link survives disconnect. Login still works. Profile shows "Connect Spotify" button to re-add playback tokens. |
| Spotify OAuth error or user denies | Callback redirects to `FRONTEND_URL?error={error}`. `page.tsx` displays the error. |
| Future: SoundCloud login | New `src/handlers/auth/soundcloud.py` — same structure as `spotify.py`. Calls same `find_or_create_user_with_platform()`. Add 2 routes to `main.py`. Add button to `LoginSection`. |

---

## Out of Scope

- Cross-account merging: if a user has logged in with Google and connected Spotify as a platform, then tries "Login with Spotify" on a second device, a separate account is created. Account linking/merging is deferred.
- SoundCloud login implementation (covered by this design's extension pattern, not implemented here)
