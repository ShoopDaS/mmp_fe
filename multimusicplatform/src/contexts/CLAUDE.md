# contexts/CLAUDE.md

## Provider Nesting Order

```
AuthProvider          ← outermost (no deps)
  QueueProvider       ← no deps on other contexts
    HubProvider       ← depends on AuthContext
      AppLayout       ← consumes all three
```

Do not reorder. `HubProvider` calls `useAuth()` internally — it must be nested inside `AuthProvider`.

---

## AuthContext (`AuthContext.tsx`)

**Owns:** Session token (`session_token` key in localStorage), `user: User | null`, `isLoading`, `isAuthenticated`, `login()`, `logout()`, `refreshUser()`.

**Login flow:** `login(sessionToken)` stores the token in localStorage then calls `loadUser()` which hits `apiClient.getUserProfile()`. On success, sets `user`. On 4xx, clears the invalid token.

**Exposed:** `{ user, isLoading, isAuthenticated, login, logout, refreshUser }`

**Must NOT be used for:** Platform OAuth tokens, playlist data, playback state.

**Where to add:** New auth providers (Microsoft, GitHub stubs are in `LoginSection.tsx` + `ProviderButton.tsx`) — add `apiClient.{provider}Login()` call and wire it here.

---

## QueueContext (`QueueContext.tsx`)

**Owns:** The ordered track list (`tracks: Track[]`), `currentIndex`, `loopMode` (`'none' | 'all' | 'one'`), `shuffle`, `sourceLabel`.

**Actions exposed:** `playFromList(tracks, startIndex, label?)`, `addToQueue(tracks[])`, `playNext(track)`, `removeFromQueue(index)`, `moveTrack(from, to)`, `next()`, `previous()`, `jumpTo(index)`, `cycleLoopMode()`, `setLoopMode()`, `toggleShuffle()`, `clearQueue()`, `getCurrentTrack()`.

**`next()` behavior:** Respects `loopMode` and `shuffle`. Returns `boolean` (true = advanced, false = at end with no loop). `loopMode: 'one'` is NOT handled here — `UnifiedMusicPlayer` re-plays the current track via `onTrackEnd` callback logic.

**`playFromList()`** preserves current `loopMode` (intentional — user's loop preference survives playlist changes).

**Access via:** `useQueue()` hook from `hooks/useQueue.ts` — do not use `useContext(QueueContext)` directly.

**Must NOT be used for:** Playing state signal (`isPlaying` belongs in `HubContext`), platform tokens, UI toggle signals.

---

## HubContext (`HubContext.tsx`)

**Owns:** Platform OAuth tokens (`spotifyToken`, `youtubeToken`, `soundcloudToken`), token refresh + caching in localStorage (`{platform}_token` keys with `{ accessToken, expiresAt }` JSON), `customPlaylists: CustomPlaylist[]`, `activePlaylist: UnifiedPlaylist | null`, `playlistTrackIds: Record<string, Set<string>>`, `globalPlayToggle` counter, `isPlaying`.

**Token caching:** `getStoredToken(platform)` reads from localStorage and checks `expiresAt`. Tokens are stored 5 minutes before actual expiry (300s buffer). `loadPlatformTokens()` tries localStorage first, then calls backend refresh endpoints.

**`globalPlayToggle`:** An incrementing number. `AppLayout` watches it via `useEffect` to call `playerRef.current.togglePlay()`. This is a "fire signal" pattern — not a boolean state.

**`isPlaying`:** Set by `UnifiedMusicPlayer` via `onPlayerStateChange` prop → `setIsPlaying`. Read by `AppLayout` for the mobile mini-player play/pause icon.

**`activePlaylist`:** Set by `LeftSidebar.handlePlaylistSelect()` when a user clicks a playlist. `search/page.tsx` watches `activePlaylist` changes to load playlist tracks.

**`playlistTrackIds`:** Maps MMP `playlistId → Set<trackId>` (prefixed, e.g. `"spotify-3n3Pp..."`). Used for duplicate detection when adding tracks to MMP playlists. Updated by `search/page.tsx` and `LeftSidebar` after mutations.

**Must NOT be used for:** Queue management (that's `QueueContext`), session auth (that's `AuthContext`).

**Where to add new global state:** If state is needed across `LeftSidebar`, `search/page.tsx`, and `AppLayout` simultaneously — add to `HubContext`. If it's only needed within the player column — keep it local to `UnifiedMusicPlayer`. If it's queue mechanics — it belongs in `QueueContext`.
