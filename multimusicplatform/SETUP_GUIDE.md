# Frontend Setup Guide - Next.js Migration

## Quick Start

```bash
# Navigate to frontend directory
cd ~/Projects/mmp_fe/multimusic-frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.template .env.local

# Start development server
npm run dev
```

Application runs at: http://127.0.0.1:3000

## Project Structure

```
multimusic-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with AuthProvider
│   │   ├── page.tsx             # Landing/Login page
│   │   ├── globals.css          # Global styles + Tailwind
│   │   ├── dashboard/
│   │   │   └── page.tsx         # User dashboard
│   │   ├── search/
│   │   │   └── page.tsx         # Music search
│   │   └── profile/
│   │       └── page.tsx         # User profile
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginSection.tsx
│   │   │   └── ProviderButton.tsx
│   │   ├── dashboard/
│   │   │   ├── PlatformCard.tsx
│   │   │   └── ConnectButton.tsx
│   │   ├── music/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── TrackList.tsx
│   │   │   └── MusicPlayer.tsx
│   │   └── layout/
│   │       └── Header.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx      # Authentication state management
│   └── lib/
│       └── api.ts               # Backend API client
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── .env.local                   # Create from template
```

## Environment Variables

Create `.env.local`:
```bash
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
NEXT_PUBLIC_FRONTEND_URL=http://127.0.0.1:3000
```

## Key Features Implemented

### Authentication Flow
1. **Landing Page** (`/`)
   - SSO login buttons (Google, Microsoft, GitHub)
   - Handles OAuth callback with session token
   - Auto-redirects authenticated users to dashboard

2. **Auth Context** (`AuthContext.tsx`)
   - Global authentication state
   - Session token management (localStorage)
   - User profile caching
   - Login/logout functions

3. **API Client** (`lib/api.ts`)
   - Centralized backend communication
   - Automatic Bearer token injection
   - Type-safe responses
   - Error handling

### Dashboard (`/dashboard`)
- Welcome message with user info
- Connected platforms display
- Platform connection buttons
- Success/error notifications
- Navigate to search when Spotify connected

### Music Search (`/search`)
- Search bar with Spotify API integration
- Track list with album art
- Click to play preview (30 seconds)
- Fixed bottom player
- Auto token refresh on expiry

### Profile (`/profile`)
- User information display
- Linked auth providers list
- Account settings (future)

## User Flow

### New User
```
1. Visit / (landing page)
2. Click "Continue with Google"
3. Google OAuth → Callback to / with ?session=TOKEN
4. Auto login and redirect to /dashboard
5. Click "Connect Spotify"
6. Spotify OAuth → Callback to /dashboard?spotify=connected
7. Click "Start Searching Music"
8. Navigate to /search
9. Search and play music!
```

### Returning User
```
1. Visit / (landing page)
2. Session token detected in localStorage
3. Auto fetch user profile
4. Auto redirect to /dashboard
5. Continue where they left off
```

## Component Details

### AuthProvider (Global State)
Wraps entire app in `layout.tsx`. Provides:
- `user`: Current user object or null
- `isLoading`: Initial load state
- `isAuthenticated`: Boolean auth status
- `login(token)`: Store token and load user
- `logout()`: Clear session
- `refreshUser()`: Reload user data

### API Client
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

### Protected Routes
Pages check authentication:
```typescript
useEffect(() => {
  if (!authLoading && !isAuthenticated) {
    router.push('/');
  }
}, [authLoading, isAuthenticated, router]);
```

## Session Management

### Storage
- Session tokens stored in `localStorage`
- Key: `session_token`
- Automatically included in API requests

### Expiration
- JWT tokens expire per backend config (default 7 days)
- Invalid tokens cause redirect to login
- User must re-authenticate

## Spotify Integration

### Token Management
- Spotify tokens separate from session tokens
- Refreshed automatically via backend
- Used directly for Spotify API calls

### Music Playback
- Free users: 30-second previews
- Premium users: Full playback via Web Playback SDK (future)
- Current: Simple HTML5 audio player

## Styling

### Tailwind CSS
- Utility-first approach
- Custom colors in `tailwind.config.js`
- Dark theme with gradients
- Responsive by default

### Design System
- Background: Purple/blue gradient
- Cards: Glass morphism (backdrop-blur)
- Buttons: Platform-specific colors
- Spotify green: `#1DB954`

## Development Tips

### Hot Reload
Next.js auto-refreshes on file changes. Server restarts on:
- Config file changes
- New dependencies
- Environment variable changes

### TypeScript
- Strict mode enabled
- Type checking on build
- IntelliSense in VS Code

### Debugging
```bash
# Check browser console for errors
# Network tab for API calls
# React DevTools for component state
```

## Testing the Flow

### 1. Test Login
```
1. Start backend (port 8080)
2. Start frontend (port 3000)
3. Visit http://127.0.0.1:3000
4. Click "Continue with Google"
5. Complete OAuth
6. Should redirect to /dashboard
```

### 2. Test Spotify Connection
```
1. From /dashboard
2. Click Spotify connect button
3. Complete OAuth
4. Should return to /dashboard with success message
```

### 3. Test Search
```
1. Click "Start Searching Music"
2. Enter search query
3. Click search
4. Results should appear
5. Click track to play preview
```

## Common Issues

### "Authentication required"
- Session token missing or expired
- Logout and login again
- Check localStorage has `session_token`

### "Spotify not connected"
- Visit /dashboard
- Connect Spotify
- Retry search

### 401 Errors
- Backend not running
- Wrong BACKEND_URL in .env.local
- CORS issues (check backend CORS config)

### No search results
- Invalid Spotify token
- Check network tab for API errors
- Verify Spotify OAuth credentials

## Production Build

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```

## Next Steps

1. Add Microsoft/GitHub OAuth
2. Implement SoundCloud support
3. Add full Spotify Web Playback SDK
4. Create playlists
5. Multi-platform search
6. User preferences/settings

## File Checklist

Ensure all files are in place:
- [ ] package.json
- [ ] tsconfig.json
- [ ] tailwind.config.js
- [ ] next.config.js
- [ ] .env.local (from template)
- [ ] src/app/layout.tsx
- [ ] src/app/page.tsx
- [ ] src/app/globals.css
- [ ] src/app/dashboard/page.tsx
- [ ] src/app/search/page.tsx
- [ ] src/app/profile/page.tsx
- [ ] src/contexts/AuthContext.tsx
- [ ] src/lib/api.ts
- [ ] All components in src/components/

## Support

For issues:
1. Check browser console
2. Check network requests
3. Verify environment variables
4. Ensure backend is running
5. Check backend logs
