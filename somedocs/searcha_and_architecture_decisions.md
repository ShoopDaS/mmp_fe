# MMP - Search & Playlist Architecture Decisions

## Two Types of Playlists

### 1. Native Platform Playlists
**What:** Managing users' existing Spotify/SoundCloud playlists through your UI
**Storage:** Lives on platform servers (Spotify/SoundCloud)
**Implementation:** 
- Request playlist OAuth scopes (e.g., `playlist-modify-public`, `playlist-modify-private`)
- Make API calls to add/remove/reorder tracks
- No data stored in your database (may cache client-side)
**Constraints:** Can only add platform-specific tracks (Spotify → Spotify, SoundCloud → SoundCloud)

### 2. Custom MultiMusic Playlists
**What:** Your unique cross-platform playlists
**Storage:** Your DynamoDB
**Implementation:**
- Store playlist metadata as one item: `{userId: "mmp_uuid", sk: "playlist#<id>", name, description, createdAt}`
- Store each track as separate item: `{userId: "mmp_uuid", sk: "playlist#<id>#track#<seq>", platform, trackId, title, artist, ...}`
**Benefits:** Can mix Spotify, SoundCloud, and future platforms in one playlist

## Search Architecture

### General Music Search (Main Search Box)
**Current Implementation:**
- Direct API calls from frontend to Spotify/SoundCloud
- User searches "Radiohead" → parallel calls to both platforms with OAuth tokens
- Merge and display results in UI
- **No backend storage, no Elasticsearch needed**

### Playlist Filtering (Within Open Playlist)
**Current Implementation:**
- Load playlist from DynamoDB once
- Keep tracks in frontend state as JavaScript array
- Filter client-side: `tracks.filter(track => track.title.includes(query))`
- Instant even with 500+ tracks
- **No Elasticsearch needed, pure client-side**

### "Local" Search (Future - Search Across All User's Playlists)
**Phase 1 - Recommended Start:**
- Load all user's playlists into IndexedDB + app state
- Search client-side through in-memory data
- Test with realistic volumes (20 playlists × 150 tracks = 3,000 tracks = ~1.5MB)
- **No Elasticsearch needed initially**

**Phase 2 - Only If Needed:**
- If client-side too slow OR massive libraries (50+ playlists, thousands of tracks)
- Consider adding Elasticsearch with lightweight documents:
  - Store only: trackTitle, artist, playlistId, userId, platform
  - Query Elasticsearch for matches, fetch full data from DynamoDB
  - Hybrid: Elasticsearch for search, DynamoDB as source of truth

## Storage Strategy

### DynamoDB (Primary Database)
- User profiles and OAuth tokens
- Platform connections (Spotify, SoundCloud tokens)
- Custom playlist metadata and tracks (multi-item pattern)
- Source of truth for everything

### Redis/ElastiCache (Optional, Later)
- Cache SoundCloud stream URLs (2-hour TTL)
- Reduces API rate limit pressure
- Key: `soundcloud:stream:<trackId>`, Value: `streamUrl`

### IndexedDB (Client-Side)
- Cache playlist data for offline/faster loading
- Cache track metadata to reduce API calls
- TTL: 24 hours for playlists, 1 week for tracks

### Elasticsearch (NOT NEEDED NOW)
- Only add if "local search" across all playlists becomes critical
- Only if client-side search proves too slow at scale
- Adds significant complexity - defer until necessary

## Key Insights

1. **You're building an aggregation layer, not a music database**
   - Most searches go directly to platform APIs
   - You only store references and metadata, not music data

2. **Client-side can handle more than you think**
   - Modern browsers easily filter thousands of tracks in milliseconds
   - IndexedDB can cache megabytes of data
   - Start simple, add infrastructure only when proven necessary

3. **Rate limits matter more than storage**
   - SoundCloud's API limits are application-level (shared across all users)
   - Smart caching (stream URLs, search results) is more important than big databases
   - Client-side caching distributes the load

4. **Scale incrementally**
   - Start: DynamoDB only
   - Later: Add Redis for SoundCloud stream URL caching
   - Much later: Add Elasticsearch only if local search needs it

## API Endpoints for Custom Playlists

```
GET    /playlists              # List user's custom playlists
POST   /playlists              # Create new playlist
GET    /playlists/{id}         # Get playlist with all tracks
PUT    /playlists/{id}         # Update playlist metadata
DELETE /playlists/{id}         # Delete playlist

POST   /playlists/{id}/tracks          # Add track
DELETE /playlists/{id}/tracks/{index}  # Remove track
PUT    /playlists/{id}/tracks/reorder  # Reorder tracks
```

All require JWT authentication via Bearer token.

## Data Model Example (DynamoDB)

```python
# Playlist metadata
{
    'userId': 'mmp_abc123',
    'sk': 'playlist#550e8400-e29b-41d4-a716-446655440000',
    'name': 'My Discovery Mix',
    'description': 'Cross-platform favorites',
    'createdAt': '2025-11-10T12:00:00Z'
}

# Track in playlist
{
    'userId': 'mmp_abc123',
    'sk': 'playlist#550e8400-e29b-41d4-a716-446655440000#track#0001',
    'platform': 'spotify',
    'trackId': '3n3Ppam7vgaVa1iaRUc9Lp',
    'title': 'Mr. Brightside',
    'artist': 'The Killers',
    'duration': 222,
    'addedAt': '2025-11-10T12:05:00Z'
}
```

## Decision: No Elasticsearch Until Proven Necessary

**Reasoning:**
- Adds infrastructure complexity (dev + prod)
- Client-side search handles realistic data volumes
- Most search goes directly to platform APIs anyway
- Can add later without fundamental architecture changes
- Start simple, scale when needed
