# Unison (MultiMusic Platform) — Frontend

Next.js 15 / React 18 / TypeScript / Tailwind CSS multi-platform music aggregator.
Users connect Spotify, YouTube, and SoundCloud then search, play, and manage cross-platform playlists.

For full architecture, context ownership, and component routing see `src/CLAUDE.md`.

## Commands

```bash
npm run dev      # Dev server → http://127.0.0.1:3000 (binds 127.0.0.1, not localhost)
npm run build    # Production build
npm start        # Production server → http://127.0.0.1:3000
npm run lint     # ESLint
```

## Environment Setup

```bash
cp .env.local.template .env.local
```

Required vars (both must be set):
```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FRONTEND_URL=http://127.0.0.1:3000
```

Backend must be running on port 8080. Frontend won't function without it.

## Key Entry Points

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout — wraps app in AuthProvider → QueueProvider → HubProvider |
| `src/app/page.tsx` | Landing / login page (Google + Spotify OAuth; Microsoft remains a stub) |
| `src/app/dashboard/page.tsx` | Post-login dashboard; handles OAuth callbacks |
| `src/app/search/page.tsx` | Main app page — cross-platform search, playlist management |
| `src/lib/api.ts` | `apiClient` singleton — all backend calls go through here |
| `src/lib/platformHelpers.ts` | Direct Spotify/YouTube/SoundCloud API calls (not via backend) |

## Gotchas

- Dev server binds to `127.0.0.1`, not `localhost` — use `http://127.0.0.1:3000`
- Image domains (Spotify, YouTube, SoundCloud) must be whitelisted in `next.config.js`
- SoundCloud API auth header is `Authorization: OAuth ${token}` — not `Bearer`
- Spotify has two playback paths: Premium (Web Playback SDK) and Free (30s preview via HTML5 Audio)
- Session token stored in `localStorage` under key `session_token`
- `CustomPlaylist.playlistId` — not `.id` (accessing `.id` returns undefined)
