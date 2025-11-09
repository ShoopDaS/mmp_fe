# MultiMusic Platform - Frontend (v2.0)

A unified music platform that provides a single interface for multiple streaming services with multi-provider SSO authentication.

## Overview

The frontend is a modern Next.js application that allows users to:
- **Login once** with Google (Microsoft/GitHub coming soon)
- **Connect multiple music platforms** (Spotify, SoundCloud, etc.)
- **Search and play** music from connected platforms
- **Premium playback** for Spotify Premium users (full songs via Web Playback SDK)
- **Preview playback** for free users (30-second clips)

## Architecture

### v2.0 Features
- **Multi-provider SSO**: Login with Google, Microsoft, or GitHub
- **Platform connections**: Link multiple music services to one account
- **Premium playback**: Full Spotify tracks for Premium users
- **Smart fallback**: Auto-detects Premium vs Free and adapts playback
- **Session management**: JWT-based authentication
- **Client-side API calls**: Direct to Spotify for best performance

### User Flow
```
Landing Page
    ↓
Google Login (SSO)
    ↓
Dashboard (Welcome screen)
    ↓
Connect Spotify (Platform link)
    ↓
Search & Play Music
    ↓
Premium: Full songs
Free: 30s previews
```

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React 18** - Modern React with hooks
- **Spotify Web Playback SDK** - Premium music playback
- **Spotify Web API** - Search and track info

## Features by Account Type

### Spotify Premium Users
✅ **Full track playback** via Spotify Web Playback SDK  
✅ High-quality audio streaming  
✅ Play/pause/skip controls  
✅ Progress tracking  
✅ Same experience as Spotify app  

### Spotify Free Users
✅ Search functionality  
✅ 30-second preview playback  
✅ Track information & artwork  
✅ Platform still fully functional  

## Getting Started

### Prerequisites
- Node.js 18+ (tested with 24.11 LTS)
- Backend running on port 8080
- Google OAuth configured
- Spotify OAuth configured

### Installation

```bash
cd multimusic-frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.template .env.local

# Edit .env.local
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FRONTEND_URL=http://127.0.0.1:3000

# Start development server
npm run dev
```

Frontend will be available at `http://127.0.0.1:3000`

### Important Notes

#### Use 127.0.0.1, not localhost
Always use `127.0.0.1` instead of `localhost` for local development:
- Backend: `http://127.0.0.1:8080`
- Frontend: `http://127.0.0.1:3000`

This ensures consistent behavior across all OAuth providers.

#### Clear Cache After Updates
If you update components and don't see changes:
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with AuthProvider
│   │   ├── page.tsx                # Landing/Login page
│   │   ├── globals.css             # Global styles + Tailwind
│   │   ├── dashboard/
│   │   │   └── page.tsx            # User dashboard
│   │   ├── search/
│   │   │   └── page.tsx            # Music search & playback
│   │   └── profile/
│   │       └── page.tsx            # User settings
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginSection.tsx    # SSO login options
│   │   │   └── ProviderButton.tsx  # OAuth provider buttons
│   │   ├── dashboard/
│   │   │   ├── PlatformCard.tsx    # Connected platform display
│   │   │   └── ConnectButton.tsx   # Connect new platform
│   │   ├── layout/
│   │   │   └── Header.tsx          # Navigation header
│   │   └── music/
│   │       ├── SearchBar.tsx       # Search input
│   │       ├── TrackList.tsx       # Search results
│   │       └── MusicPlayerPremium.tsx  # Premium + preview player
│   ├── contexts/
│   │   └── AuthContext.tsx         # Authentication state
│   └── lib/
│       └── api.ts                  # Backend API client
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── .env.local.template
```

## Pages

### Landing Page (/)
- **Purpose**: SSO login
- **Features**: 
  - Google login button
  - Microsoft/GitHub (coming soon)
  - Auto-redirect if already logged in
- **OAuth callback**: Handles `?session=token` parameter

### Dashboard (/dashboard)
- **Purpose**: User home screen
- **Features**:
  - Welcome message
  - Connected platforms display
  - Connect new platforms
  - Quick actions
- **Protected**: Requires authentication

### Search (/search)
- **Purpose**: Music search and playback
- **Features**:
  - Search bar (Spotify API)
  - Track results with album art
  - Click to play
  - Premium vs Preview detection
  - Fixed bottom player
- **Protected**: Requires Spotify connection

### Profile (/profile)
- **Purpose**: User settings
- **Features**:
  - User information
  - Linked SSO providers
  - Connected platforms
  - Account management
- **Protected**: Requires authentication

## Components

### Auth Components

**LoginSection.tsx**
- Displays SSO provider buttons
- Handles login flow
- Error messaging
- Coming soon indicators

**ProviderButton.tsx**
- Individual SSO provider button
- Provider-specific styling
- Disabled state handling

### Dashboard Components

**PlatformCard.tsx**
- Shows connected music platform
- Platform icon and info
- Connection date
- Disconnect option

**ConnectButton.tsx**
- Button to connect new platform
- Platform-specific styling
- Loading states
- Coming soon indicators

### Music Components

**SearchBar.tsx**
- Search input with submit
- Loading states
- Keyboard navigation

**TrackList.tsx**
- Displays search results
- Album art thumbnails
- Click to play
- Shows which tracks are playable

**MusicPlayerPremium.tsx** ⭐
- **Premium Users**: Loads Spotify Web Playback SDK, plays full songs
- **Free Users**: Falls back to 30s preview automatically
- Debug button for troubleshooting
- Smart detection of account type
- Console logging for debugging

## Premium Playback Implementation

### How It Works

1. **SDK Loading**: Automatically loads Spotify Web Playback SDK
2. **Player Initialization**: Creates web player with user's token
3. **Account Detection**: Spotify SDK detects Premium vs Free
4. **Playback Decision**:
   - Premium → Full track via SDK
   - Free → 30s preview via HTML5 audio
5. **Seamless Experience**: User doesn't need to do anything

### Console Logs (Debug Mode)

Open browser console (F12) to see playback status:

**Premium User:**
```
🎵 Loading Spotify SDK...
✅ SDK Ready
🎮 Init Player with token: BQC...
✅ Ready! Device: abc123...
✅ Connected
🎵 Play: Song Name on device: abc123
✅ Playing
```

**Free User:**
```
🎵 Loading Spotify SDK...
✅ SDK Ready
🎮 Init Player with token: BQC...
❌ Account error: Premium required
🎵 Preview: Song Name
```

### Debug Button

The music player has a **Debug button** that logs current state:
```javascript
{
  isPremium: true/false/null,
  deviceId: "abc123...",
  hasPlayer: true/false,
  uri: "spotify:track:..."
}
```

Use this to troubleshoot playback issues.

## Authentication Flow

### Login Process
1. User clicks "Continue with Google"
2. Frontend calls `POST /auth/google/login`
3. Backend returns Google OAuth URL
4. User authenticates with Google
5. Google redirects to backend callback
6. Backend creates/finds user account
7. Backend generates JWT session token
8. Backend redirects to frontend with `?session=token`
9. Frontend stores token in localStorage
10. Frontend loads user profile
11. Frontend redirects to dashboard

### Session Management
- **Storage**: localStorage (`session_token`)
- **Format**: JWT with 7-day expiration
- **Refresh**: Manual re-login when expired
- **Logout**: Clears token and redirects to landing

### Platform Connection
1. User clicks "Connect Spotify"
2. Frontend calls `POST /platforms/spotify/connect` with session
3. Backend verifies session and returns Spotify OAuth URL
4. User authorizes Spotify
5. Spotify redirects to backend callback
6. Backend links Spotify to user account
7. Backend redirects to dashboard with success
8. User can now search music

## API Integration

### Backend API Client (`lib/api.ts`)

All backend calls go through `apiClient`:

```typescript
// Auth
await apiClient.googleLogin()

// Platforms
await apiClient.spotifyConnect()
await apiClient.spotifyRefresh()

// User
await apiClient.getUserProfile()
await apiClient.getUserPlatforms()
await apiClient.disconnectPlatform('spotify')
```

### Spotify Direct API Calls

Music operations go directly to Spotify:

```typescript
// Search (with user's token)
fetch('https://api.spotify.com/v1/search?q=...', {
  headers: { 'Authorization': `Bearer ${spotifyToken}` }
})

// Play via SDK (Premium users)
player.play({ uris: ['spotify:track:...'] })

// Preview via HTML5 (Free users)
audioElement.src = track.preview_url
audioElement.play()
```

## Styling

### Tailwind CSS
- Utility-first approach
- Dark theme with gradients
- Glass morphism effects
- Responsive by default

### Color Scheme
- Background: Purple/blue gradient
- Cards: Glass morphism (`backdrop-blur`)
- Spotify green: `#1DB954`
- Error: Red tones
- Success: Green tones

### Responsive Design
- Mobile-first approach
- Breakpoints: `md:` (768px), `lg:` (1024px)
- Flexible layouts
- Touch-friendly targets

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FRONTEND_URL=http://127.0.0.1:3000
```

**Important**: Both variables must use `127.0.0.1`, not `localhost`

## Development

### Running Dev Server
```bash
npm run dev
```

### Building for Production
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run type-check
# or
tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Common Issues

### Redirect Loop on Landing Page
**Cause**: Multiple redirects triggering in `useEffect`  
**Fixed**: Used `useRef` to track session processing

### Old Player Still Showing (No Debug Button)
**Cause**: Next.js cache not cleared  
**Solution**:
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

### Preview Playing Instead of Full Songs (Premium)
**Cause**: TrackList not passing `uri` field  
**Fixed**: Added `uri: string` to Track interface

### Backend Not Loading .env
**Cause**: Missing `load_dotenv()` in main.py  
**Fixed**: Added `from dotenv import load_dotenv` and `load_dotenv()`

### Lambda Context Error
**Cause**: Passing `None` instead of mock context  
**Fixed**: Created `MockLambdaContext` class in main.py

## Troubleshooting Premium Playback

### If Only Previews Play (You Have Premium)

1. **Check console logs**: Open F12 → Console
   - Look for "❌ Account error" → Not detected as Premium
   - Look for "✅ Ready! Device:" → Premium working

2. **Click Debug button** in player
   - `isPremium: true` → Working correctly
   - `isPremium: false` → SDK thinks you're Free

3. **Verify Spotify account**:
```bash
cd backend
python debug_spotify_complete.py
# Look for: Product: premium
```

4. **Reconnect Spotify**:
   - Go to Dashboard
   - Disconnect Spotify
   - Connect Spotify again
   - Authorize all scopes

### If No Music Plays At All

1. **Check Spotify connection**:
   - Dashboard should show Spotify as connected
   - If not, click "Connect Spotify"

2. **Check token refresh**:
```bash
# In browser console
localStorage.getItem('session_token')
# Should return a JWT token
```

3. **Check backend logs**:
```bash
# Backend terminal should show:
INFO: Refreshing Spotify access token
INFO: Refreshing token for user: mmp_xxxxx
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables (Production)
- Set in Vercel dashboard
- Use production backend URL
- Use `https://` for all URLs

## Roadmap

- [x] Multi-provider SSO UI
- [x] Google OAuth integration
- [x] Spotify connection flow
- [x] Music search interface
- [x] Premium playback (Spotify Web Playback SDK)
- [x] Preview fallback for Free users
- [x] Session management
- [ ] SoundCloud integration
- [ ] Playlist integration
- [ ] Microsoft OAuth
- [ ] GitHub OAuth
- [ ] Playlist management
- [ ] User preferences
- [ ] Mobile responsive improvements
- [ ] Progressive Web App (PWA)

## Browser Compatibility

### Spotify Web Playback SDK
- ✅ Chrome/Edge (best support)
- ✅ Firefox
- ✅ Safari (may have limitations)
- ❌ Internet Explorer (not supported)

### General App
- ✅ All modern browsers
- ✅ Mobile browsers
- ✅ Tablet browsers

