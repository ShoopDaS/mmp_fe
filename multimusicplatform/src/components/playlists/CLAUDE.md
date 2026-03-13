# components/playlists/CLAUDE.md

## Responsibility Map

### `CustomPlaylistSection.tsx`
Renders the "My Playlists" collapsible section in the sidebar. Owns: fetching MMP playlists from `apiClient.getCustomPlaylists()` on mount (sets `hasFetched` guard), delete confirmation + `apiClient.deleteCustomPlaylist()`, expanding/collapsing, converting `CustomPlaylist` → `UnifiedPlaylist` via `toUnifiedPlaylist()`. Receives `playlists` and `onPlaylistsChange` from `LeftSidebar` (which reads from `HubContext.customPlaylists`).

### `PlatformPlaylistSection.tsx`
Renders one collapsible platform section (Spotify / YouTube / SoundCloud). Lazy-fetches on first expand (not on mount). **Spotify playlists fetched client-side** via inline `fetchSpotifyPlaylists()` (uses platform token directly). **YouTube/SoundCloud playlists fetched via backend** (`apiClient.getPlatformPlaylists(platform)`). Renders `PlaylistItem` for each playlist.

### `PlaylistItem.tsx`
Individual row for a platform playlist. Owns: refresh button (hidden for Spotify — `showRefresh = platform !== 'spotify'`), import dropdown (shown only when `customPlaylists` exist and `onImportToPlaylist` provided). Calls `onImportToPlaylist(sourcePlaylist, targetPlaylistId)` from parent. Local loading/done state only.

### `PlaylistEditSidebar.tsx`
Right-side slide-in panel for editing an MMP playlist's name, description, and cover emoji. Mounts/unmounts via `isOpen` prop. Uses **optimistic update**: calls `onSave(optimistic)` immediately, then calls `apiClient.updateCustomPlaylist()`, reverts `onSave(original)` on error. Listens for ESC key. Only works with `CustomPlaylist` (platform `'mmp'`).

### `CreatePlaylistModal.tsx`
Center modal (z-100) for creating a new MMP playlist. Local state only: `name`, `description`, `coverImage` (emoji from `COVER_EMOJI_OPTIONS`). Calls `onCreate(name, desc, emoji)` callback — the actual API call (`apiClient.createCustomPlaylist`) is wired in the parent (`LeftSidebar.handleCreatePlaylist`).

### `ImportPlaylistModal.tsx`
Multi-step wizard modal for importing a platform playlist into an MMP playlist. Steps: `select-source → select-target → confirm → importing → done`. Owns all import logic: fetches source playlist tracks via `platformHelpers`, deduplicates against `playlistTrackIds`, calls `apiClient.addTrackToCustomPlaylist()` sequentially with progress tracking. ⚠️ This component is **not currently wired anywhere** in the active UI — `LeftSidebar` uses inline `handleImportToPlaylist` via `PlaylistItem` instead.

### `PlaylistSidebar.tsx`
⚠️ **UNUSED — dead code.** This was a standalone sidebar wrapper that predates `LeftSidebar`. It is not rendered anywhere. The active sidebar is `components/layout/LeftSidebar.tsx`.

---

## Sidebar vs Modal Split

| Interaction | Component type | Trigger |
|---|---|---|
| Edit existing MMP playlist (name/desc/cover) | `PlaylistEditSidebar` (right-side drawer, `translate-x` toggle) | ✏️ button in `search/page.tsx` playlist header |
| Create new MMP playlist | `CreatePlaylistModal` (center modal, z-100) | `+` button in `CustomPlaylistSection` header |
| Import platform playlist → MMP playlist | Inline via `PlaylistItem` import dropdown + `LeftSidebar.handleImportToPlaylist` | Download icon in `PlaylistItem` |

---

## Playlist Mutation State Ownership

| Mutation | Who calls API | Who updates `customPlaylists` state |
|---|---|---|
| Create playlist | `LeftSidebar.handleCreatePlaylist` | Re-fetches list from API → `setCustomPlaylists` (HubContext) |
| Delete playlist | `CustomPlaylistSection.handleDelete` | Filters local array → `onPlaylistsChange` → HubContext |
| Edit playlist metadata | `PlaylistEditSidebar.handleSave` | Optimistic update via `onSave` prop → `search/page.tsx` updates HubContext |
| Import tracks | `LeftSidebar.handleImportToPlaylist` | `setCustomPlaylists` (updates `trackCount`), `setPlaylistTrackIds` |
| Remove track from playlist | `search/page.tsx` `handleRemoveFromPlaylist` | Updates local `playlistTracks` state + HubContext `customPlaylists` trackCount |
| Reorder tracks | `search/page.tsx` `handleReorderTracks` | Updates local `playlistTracks` state, calls `apiClient.reorderCustomPlaylistTracks` |

---

## State Ownership Quick Reference

| State | Where it lives |
|---|---|
| `customPlaylists[]` list | `HubContext` (source of truth), passed down as props |
| `activePlaylist` (currently open) | `HubContext` |
| `playlistTrackIds` (MMP dedup map) | `HubContext` |
| Loaded platform playlists | `PlatformPlaylistSection` local state (re-fetched per session) |
| `platformPlaylistTrackIds` (platform dedup) | `search/page.tsx` local state |
| Edit form values (name/desc/cover) | `PlaylistEditSidebar` local state (synced via `useEffect` on `playlist.playlistId`) |
| Import progress/steps | `ImportPlaylistModal` local state |
