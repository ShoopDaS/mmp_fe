# src/CLAUDE.md — Unison (MultiMusic Platform) Frontend

**App name:** Unison (`BRAND.name` in `lib/constants/brand.ts`). A multi-platform music aggregator: users connect Spotify, YouTube, and SoundCloud then search, play, and manage cross-platform playlists from one UI.

**Stack:** Next.js 15, App Router (`src/app/`), TypeScript, Tailwind CSS with CSS variable theming (`--bg-base`, `--accent-color`, etc.), custom player adapter pattern.

---

## Architecture

### Player Adapter Pattern
`UnifiedMusicPlayer` is the single active player. It instantiates a per-platform adapter (`SpotifyAdapter` | `SoundCloudAdapter` | `YouTubeAdapter`) on demand, caches all initialized adapters in a `useRef` map, and `suspend()`s the old adapter when switching platforms. All adapters implement `IPlayerAdapter`. See `lib/player-adapters/CLAUDE.md`.

### Context Ownership Map
| Context | Owns | Must NOT be used for |
|---|---|---|
| `AuthContext` | `session_token` in localStorage, `user` profile, `login/logout` | Platform tokens, playlists |
| `QueueContext` | `tracks[]`, `currentIndex`, loop mode, shuffle | Playing state signal to UI, platform tokens |
| `HubContext` | Platform OAuth tokens (`spotifyToken` etc.), `customPlaylists[]`, `activePlaylist`, `playlistTrackIds`, `globalPlayToggle`, `isPlaying` | Auth session, queue management |

**Dependency order (outermost first):** `AuthProvider → QueueProvider → HubProvider → AppLayout`
`HubContext` reads `isAuthenticated` from `AuthContext` — it must be nested inside `AuthProvider`.

---

## Directory Map

| Directory | What lives here |
|---|---|
| `app/` | Pages only. Auth redirect logic in `page.tsx`, OAuth callback forwarding in `dashboard/page.tsx`. No components defined here. |
| `app/search/` | The heaviest page: cross-platform search, playlist track loading, all add-to-playlist orchestration. |
| `components/auth/` | Login UI only (`LoginSection`, `ProviderButton`). Only Google OAuth is active; Microsoft/GitHub are stubs. |
| `components/dashboard/` | Profile page components: `PlatformCard` (shows connected platform), `ConnectButton` (initiates OAuth). |
| `components/layout/` | `AppLayout` (3-pane shell: sidebar + main + player), `LeftSidebar` (nav + playlist library). |
| `components/music/` | Player UI + search inputs. See `components/music/CLAUDE.md`. |
| `components/playlists/` | All playlist sidebar/modal components. See `components/playlists/CLAUDE.md`. |
| `components/queue/` | `QueueManager` — the "Up Next" list rendered inside the player column. |
| `components/icons/` | `BrandIcons.tsx` — SVG components: `SpotifyIcon`, `SoundCloudIcon`, `YouTubeIcon`, `DefaultMusicIcon`. |
| `contexts/` | The 3 global contexts. See `contexts/CLAUDE.md`. |
| `hooks/` | `useQueue.ts` — thin accessor for `QueueContext`. No logic here. |
| `lib/api.ts` | `apiClient` singleton — all backend calls. Backend URL from `NEXT_PUBLIC_BACKEND_URL`. |
| `lib/platformHelpers.ts` | Direct calls to Spotify/YouTube/SoundCloud APIs. Used by `search/page.tsx` and `LeftSidebar`. |
| `lib/player-adapters/` | `IPlayerAdapter` interface + 3 implementations. See `lib/player-adapters/CLAUDE.md`. |
| `lib/constants/` | `brand.ts` (app name, colors), `playlist.ts` (emoji options, name/desc length limits). |
| `types/` | `playlist.ts` (`UnifiedPlaylist`, `CustomPlaylist`, `CustomTrackItem`), `queue.ts` (`QueueState`, `QueueActions`). |

---

## Component Routing

| Task | Files to touch |
|---|---|
| Change player UI (progress bar, controls, volume) | `components/music/UnifiedMusicPlayer.tsx` |
| Fix playback bug for one platform | `lib/player-adapters/{Platform}Adapter.ts` |
| Add a new streaming platform | See `lib/player-adapters/CLAUDE.md` |
| Change search behavior / filters | `app/search/page.tsx` |
| Change how playlists appear in sidebar | `components/playlists/CustomPlaylistSection.tsx` or `PlatformPlaylistSection.tsx` |
| Edit/rename an MMP playlist | `components/playlists/PlaylistEditSidebar.tsx` |
| Create a new MMP playlist | `components/playlists/CreatePlaylistModal.tsx` + `LeftSidebar.tsx` (wires `handleCreatePlaylist`) |
| Import platform playlist into MMP | `components/playlists/ImportPlaylistModal.tsx` (⚠️ not currently wired in the sidebar — see note below) |
| Modify the left sidebar nav or layout | `components/layout/LeftSidebar.tsx` |
| Add a new page | `app/{name}/page.tsx` (protect with `useAuth` redirect pattern from `dashboard/page.tsx`) |
| Change auth/session logic | `contexts/AuthContext.tsx` + `app/page.tsx` |
| Change platform token refresh | `contexts/HubContext.tsx` (`loadPlatformTokens`) |
| Modify queue behavior (next/prev/loop/shuffle) | `contexts/QueueContext.tsx` |
| Change the "Up Next" panel | `components/queue/QueueManager.tsx` |

---

## Key Conventions

- **Track IDs are platform-prefixed:** `"spotify-{id}"`, `"youtube-{id}"`, `"soundcloud-{id}"`. The raw platform identifier is in `track.uri`.
- **Duplicate detection uses two separate maps:**
  - `playlistTrackIds` (from `HubContext`) = MMP playlist → `Set<trackId>` (prefixed IDs)
  - `platformPlaylistTrackIds` (local to `search/page.tsx`) = platform playlist → `Set<uri>` (raw URIs, e.g. Spotify `spotify:track:…`)
- **Custom playlist identifier field:** `CustomPlaylist.playlistId` (not `.id`). When converted to `UnifiedPlaylist`, it maps to `.id`. The `toUnifiedPlaylist()` helper in `CustomPlaylistSection` does this.
- **Platform values:** `'spotify' | 'soundcloud' | 'youtube'` for media; `'mmp'` only in `UnifiedPlaylist.platform` to identify MMP-owned playlists.
- **CSS theming:** Use Tailwind tokens `bg-base`, `bg-surface`, `bg-surface-hover`, `text-primary`, `text-secondary`, `accent` — these map to CSS vars. Don't use raw Tailwind grays for structural backgrounds.
- **SoundCloud auth header:** `Authorization: OAuth ${token}` (not `Bearer`).

---

## What NOT to do

- **Don't touch `MusicPlayerPremium.tsx`** — it is dead code (Spotify-only, no adapter pattern, not imported anywhere). All player changes go in `UnifiedMusicPlayer.tsx`.
- **Don't touch `PlaylistSidebar.tsx`** — it is a superseded component not rendered anywhere. The active sidebar is `LeftSidebar.tsx`.
- **Don't add new global state to `QueueContext`** — it owns queue mechanics only. Player UI state (isPlaying, volume) lives in `UnifiedMusicPlayer` local state. Cross-component play signals use `HubContext.globalPlayToggle`.
- **Don't call platform APIs directly from components** — use `lib/api.ts` (`apiClient`) for backend calls and `lib/platformHelpers.ts` for direct platform API calls. Don't inline fetch calls in new components.
- **Don't use `PlaylistSidebar` import path** — import from `components/layout/LeftSidebar` for the sidebar.
- **Don't assume `CustomPlaylist.id`** — the field is `playlistId`. Accessing `.id` on a `CustomPlaylist` will be undefined.
