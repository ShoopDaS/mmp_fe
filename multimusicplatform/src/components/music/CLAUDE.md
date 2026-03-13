# components/music/CLAUDE.md

## The Two Players

| File | Status | Role |
|---|---|---|
| `UnifiedMusicPlayer.tsx` | **Active** | Orchestrator: manages adapter lifecycle, caches all platform adapters, drives all playback |
| `MusicPlayerPremium.tsx` | **Dead code** | Old Spotify-only player, not imported anywhere. Do not touch or resurrect. |

**UnifiedMusicPlayer** does everything: initializes the right adapter for `track.platform`, caches adapters in `adaptersMap` ref (keyed by platform), suspends the previous platform's adapter when switching, fires `onTrackEnd` → `queue.next()`, exposes `togglePlay()` via `forwardRef` / `useImperativeHandle` (typed as `UnifiedMusicPlayerRef`). It renders the player UI inline as a full-height `<aside>` plus embeds `QueueManager`.

---

## Component Responsibilities

| Component | Owns | Does NOT own |
|---|---|---|
| `UnifiedMusicPlayer` | Adapter lifecycle, playback state (`PlayerState`), error handling + auto-skip countdown, seek/volume/loop UI | Queue state (reads from `useQueue`), active track (received as prop) |
| `QueueManager` | "Up Next" list display, drag-to-reorder within queue, add-to-custom-playlist from queue, remove from queue | Player controls, current track display |
| `SearchBar` | Search text input + submit, platform filter picker (embeds `PlatformSelector`) | Calling the actual search APIs (delegates via `onSearch` callback) |
| `PlatformSelector` | Platform checkbox dropdown UI, `PlatformState` type | Which platforms have active tokens |
| `TrackList` | Track rows, per-row context menu (play next, add to queue, add to playlist), drag-to-reorder in custom playlists, remove from custom playlist | Fetching tracks, playlist mutation API calls (all delegated via callbacks) |
| `PlaylistCover` | Renders an emoji as playlist cover art (3 sizes: `sm`/`md`/`lg`) | Nothing else — pure presentational |

---

## Data Flow: Track → Queue → Player

```
1. User searches → search/page.tsx calls platform APIs → sets local `tracks[]` state
2. User clicks track → handlePlayTrack → queue.playFromList(tracks, index, label)
   (QueueContext.state.tracks + currentIndex update)
3. AppLayout reads queue.getCurrentTrack() → passes as `track` prop to UnifiedMusicPlayer
4. UnifiedMusicPlayer useEffect [track.platform, token]:
   - If adapter cached: restore() → setReadyPlatform(platform)
   - If new: create adapter → initialize(token) → setReadyPlatform(platform)
5. UnifiedMusicPlayer useEffect [track.id, readyPlatform, canPlay]:
   - adapter.play(track)
6. Adapter fires onStateChange(state) → setPlayerState(state) → UI re-renders
7. Adapter fires onTrackEnd() → onTrackEnd prop → queue.next()
```

**Global play/pause toggle path** (from TrackList's play icon on current track):
- `TrackList` calls `onTogglePlay` prop
- `search/page.tsx` wires this to `HubContext.triggerTogglePlay()`
- `HubContext` increments `globalPlayToggle` counter
- `AppLayout` watches `globalPlayToggle` → calls `playerRef.current.togglePlay()`
- `playerRef` is a `UnifiedMusicPlayerRef` via `forwardRef`

---

## Common Music-Related Tasks

| Task | File(s) |
|---|---|
| Change player control layout (buttons, progress bar) | `UnifiedMusicPlayer.tsx` (lines ~290–400) |
| Fix seek/volume/loop behavior | `UnifiedMusicPlayer.tsx` handlers + relevant `{Platform}Adapter.ts` |
| Change what appears in "Up Next" panel | `QueueManager.tsx` |
| Modify track row appearance (album art, badges, layout) | `TrackList.tsx` |
| Add/remove platform from the search filter dropdown | `PlatformSelector.tsx` |
| Change the search input design | `SearchBar.tsx` |
| Change playlist cover emoji set or sizing | `PlaylistCover.tsx` + `lib/constants/playlist.ts` |
| Handle a new error case from platform adapter | `UnifiedMusicPlayer.tsx` — error state + `autoSkipCountdown` logic (lines ~67–88) |

---

## ⚠️ Notes

- `TrackList` has a massive prop interface (~15 props). When adding new track-level actions, add a callback prop — do not import context directly into TrackList.
- `UnifiedMusicPlayer` uses two separate `useEffect`s for platform setup (effect 1) and actual play (effect 2). The split exists to safely handle the async gap between adapter initialization and track readiness. Don't merge them.
- `QueueManager` renders `null` when `upcomingTracks.length === 0` — this is intentional (no empty-state UI).
- YouTube search in `search/page.tsx` filters by `embeddable === true` at fetch time, but embed restrictions can change — playback errors (codes 101/150) still occur and are handled in `YouTubeAdapter.handleError()`.
