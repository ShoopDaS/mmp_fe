# Spotify Login Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Login with Spotify" to the main login screen, auto-connecting Spotify as a music platform in a single OAuth flow.

**Architecture:** A new `find_or_create_user_with_platform()` method on `BaseAuthHandler` encapsulates the dual DynamoDB write (auth link + platform tokens). A new thin `handlers/auth/spotify.py` handles the OAuth flow and calls this method. The frontend adds a Spotify button to `LoginSection` using an updated `ProviderButton`.

**Tech Stack:** Python (FastAPI + boto3 + httpx), pytest + pytest-mock, TypeScript (Next.js 15 + React)

**Spec:** `docs/superpowers/specs/2026-03-14-spotify-login-design.md`

---

## Chunk 1: Backend — `find_or_create_user_with_platform()` on BaseAuthHandler

### Task 1: Write failing test for `find_or_create_user_with_platform()`

**Files:**
- Create: `mmp_be/multimusic-platform-backend/tests/unit/test_base_auth_handler.py`

- [ ] **Step 1: Create the test file**

Working directory: `mmp_be/multimusic-platform-backend/`

```python
# tests/unit/test_base_auth_handler.py
"""Unit tests for BaseAuthHandler"""
import pytest
from unittest.mock import MagicMock, patch, call


@pytest.fixture
def auth_handler():
    """Create BaseAuthHandler with mocked dependencies.
    base.py creates db_service/jwt_service as module-level singletons, so we
    replace the instance attributes directly rather than patching constructors.
    """
    from src.handlers.auth.base import BaseAuthHandler
    handler = BaseAuthHandler('spotify')
    handler.db_service = MagicMock()
    handler.jwt_service = MagicMock()
    yield handler


def test_find_or_create_user_with_platform_creates_auth_and_platform(auth_handler):
    """find_or_create_user_with_platform writes both auth and platform items"""
    # Arrange: no existing user
    auth_handler.db_service.get_user_by_provider.return_value = None
    auth_handler.db_service.put_item = MagicMock()

    with patch('src.handlers.auth.base.BasePlatformHandler') as MockPlatform:
        mock_platform_instance = MagicMock()
        MockPlatform.return_value = mock_platform_instance

        # Act
        user_id = auth_handler.find_or_create_user_with_platform(
            provider_id='spotify123',
            email='user@example.com',
            display_name='Test User',
            access_token='acc_token',
            refresh_token='ref_token',
            expires_in=3600,
            platform_user_id='spotify123',
            scope='streaming user-read-private',
        )

    # Assert: auth items written
    assert user_id.startswith('mmp_')
    assert auth_handler.db_service.put_item.call_count == 2  # PROFILE + auth#spotify

    # Assert: platform tokens stored
    MockPlatform.assert_called_once_with('spotify')
    mock_platform_instance.store_platform_tokens.assert_called_once_with(
        user_id=user_id,
        platform_user_id='spotify123',
        access_token='acc_token',
        refresh_token='ref_token',
        expires_in=3600,
        scope='streaming user-read-private',
    )


def test_find_or_create_user_with_platform_existing_user_updates_tokens(auth_handler):
    """If auth#provider already exists, tokens are refreshed for the existing user"""
    existing_user = {'userId': 'mmp_existing', 'sk': 'auth#spotify'}
    auth_handler.db_service.get_user_by_provider.return_value = existing_user

    with patch('src.handlers.auth.base.BasePlatformHandler') as MockPlatform:
        mock_platform_instance = MagicMock()
        MockPlatform.return_value = mock_platform_instance

        user_id = auth_handler.find_or_create_user_with_platform(
            provider_id='spotify123',
            email='user@example.com',
            display_name='Test User',
            access_token='new_acc',
            refresh_token='new_ref',
            expires_in=3600,
            platform_user_id='spotify123',
        )

    assert user_id == 'mmp_existing'
    # No new profile item created
    auth_handler.db_service.put_item.assert_not_called()
    # Tokens still updated
    mock_platform_instance.store_platform_tokens.assert_called_once()
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd mmp_be/multimusic-platform-backend
source be_venv/bin/activate
pytest tests/unit/test_base_auth_handler.py -v
```

Expected: `AttributeError: 'BaseAuthHandler' object has no attribute 'find_or_create_user_with_platform'`
(Acceptable alternative: `ImportError` if `BasePlatformHandler` import hasn't been added yet — both are valid red states.)

---

### Task 2: Implement `find_or_create_user_with_platform()` in `base.py`

**Files:**
- Modify: `mmp_be/multimusic-platform-backend/src/handlers/auth/base.py`

- [ ] **Step 1: Add the import for `BasePlatformHandler` at the top of `base.py`**

After the existing imports, add:

```python
from src.handlers.platforms.base import BasePlatformHandler
```

- [ ] **Step 2: Add the method to `BaseAuthHandler`** (after `find_or_create_user`, before `link_provider_to_user`)

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
    avatar_url: Optional[str] = None,
) -> str:
    """
    Find or create a user AND store their platform tokens in one step.
    Used when a streaming platform (Spotify, SoundCloud) doubles as a login provider.

    Args:
        provider_id: Provider's unique user ID (used for auth lookup)
        email: User email
        display_name: User's display name
        access_token: OAuth access token (full platform scopes)
        refresh_token: OAuth refresh token
        expires_in: Token TTL in seconds
        platform_user_id: Platform's user ID (often same as provider_id)
        scope: OAuth scopes granted
        avatar_url: Optional avatar URL

    Returns:
        Internal user ID (mmp_xxx)
    """
    user_id = self.find_or_create_user(
        provider_id=provider_id,
        email=email,
        display_name=display_name,
        avatar_url=avatar_url,
    )

    platform_handler = BasePlatformHandler(self.provider_name)
    platform_handler.store_platform_tokens(
        user_id=user_id,
        platform_user_id=platform_user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        scope=scope,
    )

    logger.info(f"User {user_id} created/found with {self.provider_name} platform auto-connected")
    return user_id
```

- [ ] **Step 3: Run tests — confirm they pass**

```bash
cd mmp_be/multimusic-platform-backend
pytest tests/unit/test_base_auth_handler.py -v
```

Expected: `2 passed`

- [ ] **Step 4: Commit**

```bash
cd mmp_be/multimusic-platform-backend && git add src/handlers/auth/base.py tests/unit/test_base_auth_handler.py && git commit -m "feat: add find_or_create_user_with_platform to BaseAuthHandler"
```

---

## Chunk 2: Backend — Spotify auth handler + routes

### Task 3: Write failing tests for the Spotify auth handler

**Files:**
- Create: `mmp_be/multimusic-platform-backend/tests/unit/test_spotify_auth_handler.py`

- [ ] **Step 1: Create the test file**

```python
# tests/unit/test_spotify_auth_handler.py
"""Unit tests for Spotify auth handlers"""
import json
import pytest
from unittest.mock import MagicMock, patch


SPOTIFY_USER_INFO = {
    'id': 'spotify_user_abc',
    'email': 'spotify@example.com',
    'display_name': 'Spotify User',
    'images': [{'url': 'https://example.com/avatar.jpg'}],
}

TOKEN_RESPONSE = {
    'access_token': 'acc_123',
    'refresh_token': 'ref_456',
    'expires_in': 3600,
    'scope': 'streaming user-read-private',
}

MOCK_ENV = {
    'SPOTIFY_CLIENT_ID': 'test_client_id',
    'SPOTIFY_CLIENT_SECRET': 'test_client_secret',
    'SPOTIFY_AUTH_REDIRECT_URI': 'http://localhost:8080/auth/spotify/callback',
    'FRONTEND_URL': 'http://localhost:3000',
}


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    for k, v in MOCK_ENV.items():
        monkeypatch.setenv(k, v)


def test_login_handler_returns_auth_url():
    """login_handler returns a valid Spotify authorization URL"""
    import importlib
    import src.handlers.auth.spotify as spotify_mod
    importlib.reload(spotify_mod)

    event = {'headers': {}, 'body': '{}'}
    context = MagicMock()

    response = spotify_mod.login_handler(event, context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'authUrl' in body['data']
    assert 'accounts.spotify.com/authorize' in body['data']['authUrl']
    assert 'streaming' in body['data']['authUrl']
    assert 'state' in body['data']


def test_callback_handler_creates_user_and_redirects():
    """callback_handler exchanges code, creates user+platform, redirects with session"""
    import importlib
    import src.handlers.auth.spotify as spotify_mod
    importlib.reload(spotify_mod)

    event = {
        'queryStringParameters': {'code': 'auth_code_123', 'state': 'csrf_state'},
        'headers': {},
    }
    context = MagicMock()

    mock_response = MagicMock()
    mock_response.json.side_effect = [TOKEN_RESPONSE, SPOTIFY_USER_INFO]
    mock_response.raise_for_status = MagicMock()

    with patch('src.handlers.auth.spotify.auth_handler') as mock_auth, \
         patch('src.handlers.auth.spotify.httpx.Client') as MockClient:

        mock_client_instance = MagicMock()
        MockClient.return_value.__enter__.return_value = mock_client_instance
        mock_client_instance.post.return_value = mock_response
        mock_client_instance.get.return_value = mock_response

        mock_auth.find_or_create_user_with_platform.return_value = 'mmp_newuser'
        mock_auth.create_session.return_value = 'jwt_token_abc'

        response = spotify_mod.callback_handler(event, context)

    assert response['statusCode'] == 302
    assert 'http://localhost:3000?session=jwt_token_abc' in response['headers']['Location']


def test_callback_handler_redirects_on_oauth_error():
    """callback_handler redirects to frontend with error when OAuth fails"""
    import importlib
    import src.handlers.auth.spotify as spotify_mod
    importlib.reload(spotify_mod)

    event = {
        'queryStringParameters': {'error': 'access_denied'},
        'headers': {},
    }
    context = MagicMock()

    response = spotify_mod.callback_handler(event, context)

    assert response['statusCode'] == 302
    assert 'error=access_denied' in response['headers']['Location']
    assert 'http://localhost:3000' in response['headers']['Location']


def test_callback_handler_redirects_when_no_code():
    """callback_handler redirects with error when code is missing"""
    import importlib
    import src.handlers.auth.spotify as spotify_mod
    importlib.reload(spotify_mod)

    event = {'queryStringParameters': {}, 'headers': {}}
    context = MagicMock()

    response = spotify_mod.callback_handler(event, context)

    assert response['statusCode'] == 302
    assert 'error=no_code' in response['headers']['Location']
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mmp_be/multimusic-platform-backend
pytest tests/unit/test_spotify_auth_handler.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.handlers.auth.spotify'`

---

### Task 4: Create `src/handlers/auth/spotify.py`

**Files:**
- Create: `mmp_be/multimusic-platform-backend/src/handlers/auth/spotify.py`

- [ ] **Step 1: Create the file**

```python
"""
Spotify OAuth Login Handlers
"""
import os
from typing import Any, Dict
from urllib.parse import urlencode

import httpx

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

from src.handlers.auth.base import BaseAuthHandler
from src.handlers.platforms.spotify import get_spotify_user_info
from src.utils.responses import success_response, error_response, redirect_response

logger = Logger()

SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET')
SPOTIFY_AUTH_REDIRECT_URI = os.environ.get('SPOTIFY_AUTH_REDIRECT_URI')
FRONTEND_URL = os.environ.get('FRONTEND_URL')

AUTH_SCOPES = ' '.join([
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-library-read',
    'user-library-modify',
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
])

auth_handler = BaseAuthHandler('spotify')


@logger.inject_lambda_context
def login_handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """
    Initiate Spotify OAuth login.
    Returns authorization URL to redirect user to Spotify.
    """
    try:
        logger.info("Initiating Spotify OAuth login")

        state = auth_handler.generate_state()

        auth_params = {
            'client_id': SPOTIFY_CLIENT_ID,
            'response_type': 'code',
            'redirect_uri': SPOTIFY_AUTH_REDIRECT_URI,
            'state': state,
            'scope': AUTH_SCOPES,
        }

        auth_url = f"https://accounts.spotify.com/authorize?{urlencode(auth_params)}"

        return success_response({'authUrl': auth_url, 'state': state})

    except Exception as e:
        logger.exception("Error in Spotify login")
        return error_response(str(e), 500)


@logger.inject_lambda_context
def callback_handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """
    Handle Spotify OAuth callback.
    Creates/finds user, stores platform tokens, returns session JWT.
    """
    try:
        logger.info("Processing Spotify OAuth callback")

        query_params = event.get('queryStringParameters') or {}
        code = query_params.get('code')
        error = query_params.get('error')

        if error:
            logger.error(f"OAuth error from Spotify: {error}")
            return redirect_response(f"{FRONTEND_URL}?error={error}", 302)

        if not code:
            logger.error("No authorization code in callback")
            return redirect_response(f"{FRONTEND_URL}?error=no_code", 302)

        token_data = _exchange_code_for_token(code)

        user_info = get_spotify_user_info(token_data['access_token'])
        spotify_user_id = user_info['id']
        email = user_info.get('email', '')
        display_name = user_info.get('display_name', email.split('@')[0])
        images = user_info.get('images', [])
        avatar_url = images[0]['url'] if images else ''

        logger.info(f"Spotify user authenticated: {spotify_user_id}")

        user_id = auth_handler.find_or_create_user_with_platform(
            provider_id=spotify_user_id,
            email=email,
            display_name=display_name,
            access_token=token_data['access_token'],
            refresh_token=token_data['refresh_token'],
            expires_in=token_data['expires_in'],
            platform_user_id=spotify_user_id,
            scope=token_data.get('scope', ''),
            avatar_url=avatar_url,
        )

        session_token = auth_handler.create_session(user_id)

        return redirect_response(f"{FRONTEND_URL}?session={session_token}", 302)

    except Exception as e:
        logger.exception("Error in Spotify callback")
        return redirect_response(f"{FRONTEND_URL}?error=callback_failed", 302)


def _exchange_code_for_token(code: str) -> Dict[str, Any]:
    """Exchange authorization code for access + refresh tokens."""
    with httpx.Client() as client:
        response = client.post(
            'https://accounts.spotify.com/api/token',
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': SPOTIFY_AUTH_REDIRECT_URI,
                'client_id': SPOTIFY_CLIENT_ID,
                'client_secret': SPOTIFY_CLIENT_SECRET,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        response.raise_for_status()
        return response.json()
```

- [ ] **Step 2: Run the tests — confirm they pass**

```bash
cd mmp_be/multimusic-platform-backend
pytest tests/unit/test_spotify_auth_handler.py -v
```

Expected: `4 passed`

---

### Task 5: Add routes to `main.py` and update the env file

**Files:**
- Modify: `mmp_be/multimusic-platform-backend/main.py`
- Modify: `mmp_be/multimusic-platform-backend/local/.env`

- [ ] **Step 1: Import the new handler in `main.py`**

After the existing `from src.handlers.auth import google` line, add:

```python
from src.handlers.auth import spotify as spotify_auth
```

- [ ] **Step 2: Add the two new routes in `main.py`** (after the existing Google auth routes, before the Platform Connection Routes section)

```python
@app.post("/auth/spotify/login")
async def spotify_login(request: Request):
    """Initiate Spotify OAuth login"""
    event = await request_to_event(request)
    lambda_response = spotify_auth.login_handler(event, mock_context)
    return lambda_response_to_fastapi(lambda_response)


@app.get("/auth/spotify/callback")
async def spotify_callback(request: Request):
    """Handle Spotify OAuth callback"""
    event = await request_to_event(request)
    lambda_response = spotify_auth.callback_handler(event, mock_context)
    return lambda_response_to_fastapi(lambda_response)
```

- [ ] **Step 3: Fix env file — split redirect URIs**

In `local/.env`, the current `SPOTIFY_REDIRECT_URI` points to the auth path by mistake. Fix it and add the new auth URI:

Replace:
```
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/auth/spotify/callback
```

With:
```
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/platforms/spotify/callback
SPOTIFY_AUTH_REDIRECT_URI=http://127.0.0.1:8080/auth/spotify/callback
```

- [ ] **Step 4: Verify server starts and new routes appear**

```bash
cd mmp_be/multimusic-platform-backend
source be_venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8080 --reload
```

Open `http://127.0.0.1:8080/docs` and confirm `/auth/spotify/login` and `/auth/spotify/callback` appear in the list.

- [ ] **Step 5: Commit**

```bash
cd mmp_be/multimusic-platform-backend
git add src/handlers/auth/spotify.py tests/unit/test_spotify_auth_handler.py main.py local/.env
git commit -m "feat: add Spotify login handler and routes"
```

---

## Chunk 3: Frontend — Spotify login button

### Task 6: Add `spotifyLogin()` to `api.ts`

**Files:**
- Modify: `mmp_fe/multimusicplatform/src/lib/api.ts`

- [ ] **Step 1: Add `spotifyLogin()` after `googleLogin()`**

```typescript
async spotifyLogin() {
  return this.request<{ authUrl: string; state: string }>('/auth/spotify/login', {
    method: 'POST',
  });
}
```

---

### Task 7: Add Spotify to `ProviderButton`

**Files:**
- Modify: `mmp_fe/multimusicplatform/src/components/auth/ProviderButton.tsx`

- [ ] **Step 1: Add `SpotifyIcon` import**

Add to the existing import line at the top (keep `GoogleIcon`, `MicrosoftIcon`):

```typescript
import { GoogleIcon, MicrosoftIcon } from '@/components/icons/ProviderIcons';
import { SpotifyIcon } from '@/components/icons/BrandIcons';
```

- [ ] **Step 2: Add `'spotify'` to the `ProviderButtonProps` type**

```typescript
interface ProviderButtonProps {
  provider: 'google' | 'microsoft' | 'spotify';
  // ... rest unchanged
}
```

- [ ] **Step 3: Add Spotify to `providerConfig`**

```typescript
spotify: {
  name: 'Spotify',
  Icon: SpotifyIcon,
  bg: 'bg-[#1DB954] hover:bg-[#1aa34a]',
  text: 'text-black',
},
```

---

### Task 8: Add Spotify button to `LoginSection`

**Files:**
- Modify: `mmp_fe/multimusicplatform/src/components/auth/LoginSection.tsx`

- [ ] **Step 1: Add `handleSpotifyLogin`** — add after `handleGoogleLogin`:

```typescript
const handleSpotifyLogin = async () => {
  setIsLoading(true);
  setError(null);

  const response = await apiClient.spotifyLogin();

  if (response.error) {
    setError(response.error);
    setIsLoading(false);
    return;
  }

  if (response.data?.authUrl) {
    window.location.href = response.data.authUrl;
  }
};
```

- [ ] **Step 2: Add the Spotify `ProviderButton`** — insert between the Google button and the Microsoft button:

```tsx
<ProviderButton
  provider="spotify"
  onClick={handleSpotifyLogin}
  disabled={isLoading}
/>
```

- [ ] **Step 3: Verify the login page in browser**

```bash
cd mmp_fe/multimusicplatform
npm run dev
```

Open `http://127.0.0.1:3000`. Confirm:
- "Continue with Spotify" button appears in Spotify green below Google
- Clicking it hits the backend and redirects to `accounts.spotify.com`

- [ ] **Step 4: Commit**

```bash
cd mmp_fe/multimusicplatform
git add src/lib/api.ts src/components/auth/ProviderButton.tsx src/components/auth/LoginSection.tsx
git commit -m "feat: add Login with Spotify button to login screen"
```

---

## End-to-End Verification

- [ ] Start backend: `cd mmp_be/multimusic-platform-backend && uvicorn main:app --host 127.0.0.1 --port 8080`
- [ ] Start frontend: `cd mmp_fe/multimusicplatform && npm run dev`
- [ ] Click "Login with Spotify" → Spotify consent screen appears with full scopes
- [ ] After approving → redirected to `http://127.0.0.1:3000?session=<jwt>` → lands on `/dashboard`
- [ ] Go to `/profile` → Spotify appears under "Connected Music Platforms" without any additional steps
- [ ] Run full backend test suite: `pytest tests/ -v` — all pass

---

## Spotify Developer Dashboard

Before testing end-to-end, register the new redirect URI in the Spotify Developer Dashboard:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Open your app → Edit Settings
3. Add to Redirect URIs: `http://127.0.0.1:8080/auth/spotify/callback`
4. For production: add `https://<api-domain>/auth/spotify/callback`
5. Save
