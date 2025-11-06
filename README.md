# MultiMusic Platform - Frontend

A unified music platform that aggregates content from multiple streaming services (Spotify, SoundCloud, and more) into a single interface.

## Overview

This project allows users to search and play music from multiple streaming platforms without switching between apps. The platform uses a secure backend for OAuth authentication while making direct API calls from the browser for music operations.

## Features

- **Multi-platform support**: Currently supports Spotify (SoundCloud and others coming soon)
- **Unified search**: Search across multiple platforms from one interface
- **Direct streaming**: Play 30-second previews directly in the browser
- **Full playback**: Premium Spotify users can play full tracks via Web Playback SDK
- **Secure authentication**: Backend handles OAuth with Spotify
- **Session management**: JWT-based sessions for secure token management

## Tech Stack

**Frontend:**
- HTML5
- JavaScript (Vanilla)
- Tailwind CSS (via CDN)
- Spotify Web Playback SDK

**Backend:**
- Python 3.13
- FastAPI
- AWS Lambda-ready handlers
- DynamoDB for token storage
- JWT for session management

**APIs:**
- Spotify Web API
- SoundCloud API (coming soon)

## Getting Started

### Prerequisites

- Python 3.13+ (for local backend server)
- Docker (for DynamoDB Local)
- Spotify Developer account

### Backend Setup

1. **Set up the backend** (see backend README for details)
   ```bash
   cd multimusic-platform-backend
   
   # Create virtual environment
   python3.13 -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt -r requirements-dev.txt
   
   # Configure environment
   cp .env.example .env
   # Edit .env with your Spotify credentials
   
   # Start DynamoDB Local
   cd local
   docker-compose up -d
   
   # Create tables
   cd ..
   python scripts/create_tables.py
   
   # Start backend
   uvicorn local.app:app --reload --port 8080
   ```

2. **Configure Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create or edit your app
   - Add redirect URI: `http://127.0.0.1:8080/auth/spotify/callback`
   - Copy Client ID and Client Secret to backend `.env`

### Frontend Setup

1. **Start the frontend server**
   ```bash
   cd multimusic-platform
   python3 -m http.server 8081
   ```

2. **Open the app**
   - Navigate to `http://127.0.0.1:8081/music-app.html`
   - Click "Login with Spotify"
   - Start searching and playing music!

## Project Structure

```
multimusic-platform/
├── music-app.html          # Main application file
├── README.md               # This file
└── .gitignore             # Git ignore file
```

## How It Works

### Authentication Flow

1. User clicks "Login with Spotify"
2. Frontend calls backend `/auth/spotify/login`
3. Backend generates OAuth URL and returns it
4. User authorizes on Spotify
5. Spotify redirects to backend `/auth/spotify/callback`
6. Backend exchanges code for tokens
7. Backend stores encrypted tokens in DynamoDB
8. Backend generates JWT session token
9. Backend redirects to frontend with session token
10. Frontend uses session to get access tokens when needed

### API Calls

- **Authentication**: Handled by backend for security
- **Music operations**: Direct calls from browser to Spotify using user's access token
- **Token refresh**: Backend manages refresh tokens and provides new access tokens

This architecture provides:
- ✅ Secure credential storage
- ✅ No rate limiting issues (each user has their own quota)
- ✅ Better performance (direct API calls for music)
- ✅ Centralized session management

## Services Running

When fully set up, you'll have:
- **Frontend**: `http://127.0.0.1:8081`
- **Backend API**: `http://127.0.0.1:8080`
- **DynamoDB Local**: `http://127.0.0.1:8000`
- **DynamoDB Admin**: `http://127.0.0.1:8001`

## Features by Account Type

### Spotify Premium
- Full track playback via Web Playback SDK
- Skip, pause, resume controls
- Progress tracking
- High-quality audio

### Spotify Free
- 30-second preview playback
- Search functionality
- Track information
- Album artwork

## Roadmap

- [x] Spotify authentication via backend
- [x] JWT session management
- [x] Search functionality
- [x] Audio preview playback
- [x] Full track playback (Premium users)
- [ ] Token refresh automation
- [ ] SoundCloud integration
- [ ] YouTube Music integration
- [ ] Unified playlist management
- [ ] User preferences storage
- [ ] AWS deployment
- [ ] Production infrastructure (CloudFront, WAF, VPC)

## Security

- OAuth credentials stored securely in backend
- Tokens encrypted at rest in DynamoDB
- JWT session tokens for frontend authentication
- HTTPS only in production
- No sensitive data in frontend code

## Development

- Frontend is static HTML/JavaScript
- Backend handles all authentication
- Easy to test locally with hot reload
- Ready for AWS Lambda deployment