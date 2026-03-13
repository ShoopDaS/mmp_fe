# lib/player-adapters/CLAUDE.md

## IPlayerAdapter Contract

Every adapter must implement `IPlayerAdapter` from `IPlayerAdapter.ts`. Required methods:

| Method | Guarantee |
|---|---|
| `initialize(token): Promise<boolean>` | Load SDK, set up player/widget. Returns `false` on failure — caller will show error. |
| `play(track: Track): Promise<void>` | Begin playback of the given track from the start. |
| `pause(): Promise<void>` | Pause without resetting position. |
| `resume(): Promise<void>` | Resume from current position. |
| `togglePlay(): Promise<void>` | Flip play/pause. |
| `seek(positionMs): Promise<void>` | Seek to absolute position in ms. |
| `setVolume(volume): Promise<void>` | Set volume 0–1. |
| `setLoop(enabled): Promise<void>` | Toggle single-track loop. |
| `getState(): PlayerState` | Return current state snapshot (never mutate the returned object). |
| `cleanup(): void` | Disconnect SDK, remove DOM elements, cancel timers. Called on unmount. |
| `onStateChange(cb)` | Register callback — adapter calls it whenever `PlayerState` changes. |
| `onTrackEnd(cb)` | Register callback — adapter calls it when track finishes naturally. |
| `onError(cb)` | Register callback — adapter calls it on unrecoverable errors. |

**Optional (implement for proper multi-platform switching):**
- `suspend(): Promise<void>` — pause + silence; called when another platform becomes active
- `restore(): Promise<boolean>` — restore from suspended state; return `false` if reconnection failed

**`PlayerState` shape:**
```ts
{ isPlaying, currentTime, duration, volume, isLooping, isShuffle, canPlay }
// All times in milliseconds. volume is 0–1. canPlay must be true before play() is called.
```

---

## SpotifyAdapter

**SDK:** Spotify Web Playback SDK (script injected once into `document.body`, survives remounts via guard: `document.querySelector('script[src="..."]')`).

**Premium detection:** Connects to SDK; on `ready` event → `isPremium = true`, gets `deviceId`. On `account_error` or `initialization_error` → falls back to preview mode.

**Preview mode (free accounts):** Creates `HTMLAudioElement`, plays `track.preview_url` (30s clips). No `preview_url` on a free account = throws error.

**Play deduplication:** Uses `playSequence` counter + `AbortController` — rapid `play()` calls cancel the previous API request.

**Progress tracking:** Polls `player.getCurrentState()` every 500ms via `setInterval`. `player_state_changed` handles play/pause/end events organically.

**suspend/restore:** Sets player volume to 0 (stores previous volume in `volumeBeforeSuspend`). On restore, validates device is reachable via `getCurrentState()` before restoring volume.

**Quirks:**
- `isPremium` is `null` until SDK connects — don't check boolean equality, use `isPremium && deviceId`.
- HTTP 403 with `reason: PREMIUM_REQUIRED` mid-session triggers graceful fallback to preview mode.
- `player.seek()`, `player.pause()`, `player.setVolume()` may throw "streamer not ready" — all wrapped in try/catch with `console.warn`.

---

## SoundCloudAdapter

**SDK:** SoundCloud Widget API (hidden iframe `id="sc-widget"`, positioned at `-9999px` to prevent browser background throttling).

**Volume:** Widget API uses 0–100 scale; adapter normalizes to 0–1 (`setVolume(v)` sends `v * 100`).

**Duration quirk:** Duration is not available at play start; adapter fetches it lazily via `widget.getDuration()` callback on `PLAY` and `PLAY_PROGRESS` events.

**play(track):** Uses `widget.load(track.uri, { auto_play: true })` — `track.uri` must be the SoundCloud permalink URL.

**Auth header format:** SoundCloud API requires `Authorization: OAuth ${token}` (not `Bearer`). This applies in `platformHelpers.fetchSoundCloudPlaylistTracks` too.

**suspend/restore:** Sets widget volume to 0 (not pause), stores volume for restore.

**Quirks:**
- Widget reuse: if `state.canPlay` is already `true`, `initWidget()` returns early without recreating the iframe.
- Falls back to 5s timeout if `READY` event never fires.
- `setLoop` does NOT call a widget API — it only sets `state.isLooping`. Loop is handled externally by `UnifiedMusicPlayer`.

---

## YouTubeAdapter

**SDK:** YouTube IFrame Player API (script injected, `window.onYouTubeIframeAPIReady` callback). Player div `id="yt-player"` hidden via `display: none`.

**Video ID extraction:** `track.uri` stores the raw 11-char video ID. `extractVideoId()` also handles full YouTube URLs.

**Player laziness:** `ensurePlayer()` creates the YT.Player instance only on first `play()` call. Subsequent calls use `loadVideoById()`.

**Error handling:** Errors 101/150 = embed-restricted. Error handler appends a `https://www.youtube.com/watch?v=...` URL to the error message and calls `cleanup()` immediately to remove the stale iframe. The URL is parsed back in `UnifiedMusicPlayer` to render an "Open on YouTube" link.

**Loop:** Handled in `handleTrackEnd()` — if `state.isLooping`, calls `this.play(currentTrack)` again. No native YT loop API used.

**suspend/restore:** Sets player volume to 0 without pausing; stores volume for restore.

**Quirks:**
- `window.onYouTubeIframeAPIReady` is global — if two adapters initialize concurrently, the last one wins. This is safe because `UnifiedMusicPlayer` only creates one adapter at a time.
- `apiReady` and `playerReady` are separate flags — `apiReady` means SDK loaded, `playerReady` means a player instance exists.

---

## How to Add a New Adapter

1. **Create `src/lib/player-adapters/{Name}Adapter.ts`** implementing `IPlayerAdapter`. Copy the pattern from `SoundCloudAdapter` as a template.
2. **Register in `UnifiedMusicPlayer.tsx`**: add a `case '{platform}'` to the `switch` in `setupAdapter()`.
3. **Update `Track.platform` type** in `IPlayerAdapter.ts`: add `| '{platform}'` to the union.
4. **Update `UnifiedPlaylist.platform` type** in `types/playlist.ts` if playlists are supported.
5. **Update token selection in `AppLayout.tsx`** (the ternary that picks which token to pass as `UnifiedMusicPlayer.token`).
6. **Add domain to `next.config.js` images.domains** if the platform serves album art.

For deeper architectural context, see `PlayerArchitecture.md` in this directory.
