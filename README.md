# MultiMusic Platform

A unified music platform that aggregates content from multiple streaming services (Spotify, SoundCloud, and more) into a single interface.

## Overview

This project allows users to search and play music from multiple streaming platforms without switching between apps. Users authenticate with each platform individually, and all API calls are made directly from the browser using their personal access tokens.

## Features

- **Multi-platform support**: Currently supports Spotify (SoundCloud and others coming soon)
- **Unified search**: Search across multiple platforms from one interface
- **Direct streaming**: Play 30-second previews directly in the browser
- **Secure authentication**: Uses OAuth 2.0 with PKCE for secure, client-side authentication
- **No backend required**: All API calls made directly from the browser (serverless Lambda functions will be added later for production)

## Tech Stack

**Frontend:**
- HTML5
- JavaScript (Vanilla)
- Tailwind CSS (via CDN)

**APIs:**
- Spotify Web API
- SoundCloud API (coming soon)

**Future additions:**
- React/Next.js migration
- AWS Lambda for OAuth handling
- Additional streaming platforms

## Getting Started

### Prerequisites

- A Spotify Developer account
- Python 3.x (for local development server)

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd multimusicplatform
   ```

2. **Create a Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Click "Create app"
   - Fill in app details
   - Add redirect URI: `http://127.0.0.1:8081/music-app.html`
   - Save your Client ID

3. **Run the local server**
   ```bash
   python3 -m http.server 8081
   ```

4. **Open the app**
   - Navigate to `http://127.0.0.1:8081/music-app.html`
   - Enter your Spotify Client ID
   - Click "Login with Spotify"
   - Start searching!

## Project Structure

```
multimusicplatform/
├── music-app.html          # Main application file
├── README.md               # This file
└── .gitignore             # Git ignore file
```

## How It Works

### Authentication Flow (PKCE)

1. User enters Spotify Client ID
2. App generates a code verifier and challenge
3. User is redirected to Spotify for authorization
4. Spotify redirects back with an authorization code
5. App exchanges code for access token using PKCE
6. Token is stored in localStorage for subsequent requests

### API Calls

All API calls to Spotify are made directly from the browser using the user's access token. This means:
- No backend proxy needed for music queries
- Each user has their own rate limit quota
- Better performance (no intermediary server)

## Roadmap

- [x] Spotify integration
- [x] Search functionality
- [x] Audio preview playback
- [ ] SoundCloud integration
- [ ] YouTube Music integration
- [ ] Unified playlist management
- [ ] React/Next.js migration
- [ ] AWS Lambda OAuth handlers
- [ ] S3 + CloudFront deployment
- [ ] User account system

## Security Notes

- Client secrets are never exposed in the frontend
- PKCE flow ensures secure token exchange without backend
- Access tokens stored in localStorage (consider more secure options for production)
- For production, OAuth callbacks should be handled by backend Lambda functions

## Acknowledgments

- Spotify Web API
- Tailwind CSS