// Shared pure helper functions for platform API interactions.
// These are used by both search/page.tsx and ImportPlaylistModal.tsx.

export interface Track {
  id: string;
  platform: 'spotify' | 'soundcloud' | 'youtube';
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  preview_url: string | null;
}

// ========== Owned Playlist Fetchers ==========

export async function fetchSpotifyOwnedPlaylists(token: string): Promise<{ id: string; name: string }[]> {
  const meRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return [];
  const me = await meRes.json();

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.items || [])
    .filter((item: any) => item.owner?.id === me.id)
    .map((item: any) => ({ id: item.id, name: item.name }));
}

export async function fetchYouTubeOwnedPlaylists(token: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    name: item.snippet.title,
  }));
}

// ========== Add-Track Helpers ==========

export async function addTrackToSpotifyPlaylist(trackUri: string, playlistId: string, token: string): Promise<void> {
  await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [trackUri] }),
  });
}

export async function addTrackToYouTubePlaylist(videoId: string, playlistId: string, token: string): Promise<void> {
  await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    }),
  });
}

// ========== Playlist Track ID Fetchers (lightweight, for duplicate detection) ==========

/** Fetches up to 1000 track URIs from a Spotify playlist (10 pages × 100). */
export async function fetchSpotifyPlaylistTrackUris(
  playlistId: string,
  token: string | null,
): Promise<Set<string>> {
  if (!token) return new Set();

  const uris = new Set<string>();
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=${encodeURIComponent('items(track(uri)),next')}&limit=100`;
  let page = 0;

  while (url && page < 10) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;

    const data: any = await res.json();
    for (const item of data.items || []) {
      if (item.track?.uri) uris.add(item.track.uri);
    }

    url = data.next || null;
    page++;
  }

  return uris;
}

/** Fetches up to 1000 video IDs from a YouTube playlist (20 pages × 50). */
export async function fetchYouTubePlaylistVideoIds(
  playlistId: string,
  token: string | null,
): Promise<Set<string>> {
  if (!token) return new Set();

  const ids = new Set<string>();
  let pageToken: string | null = null;
  let page = 0;

  while (page < 20) {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res: Response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) break;

    const data: any = await res.json();
    for (const item of data.items || []) {
      if (item.contentDetails?.videoId) ids.add(item.contentDetails.videoId);
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
    page++;
  }

  return ids;
}

// ========== Playlist Track Fetchers ==========

export async function fetchSpotifyPlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  const allTracks: Track[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) break;

    const data: any = await response.json();

    for (const item of data.items || []) {
      const track = item.track;
      if (!track || !track.id) continue;

      allTracks.push({
        id: `spotify-${track.id}`,
        platform: 'spotify',
        name: track.name,
        uri: track.uri,
        artists: track.artists,
        album: track.album,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      });
    }

    url = data.next || null;
  }

  return allTracks;
}

export async function fetchYouTubePlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  const allTracks: Track[] = [];
  let pageToken: string | null = null;

  while (true) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: playlistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response: Response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) break;

    const data: any = await response.json();

    for (const item of data.items || []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;

      const snippet = item.snippet || {};
      const thumbnails = snippet.thumbnails || {};
      const imageUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';

      allTracks.push({
        id: `youtube-${videoId}`,
        platform: 'youtube',
        name: snippet.title || 'Unknown',
        uri: videoId,
        artists: [{ name: snippet.videoOwnerChannelTitle || snippet.channelTitle || '' }],
        album: {
          name: snippet.videoOwnerChannelTitle || snippet.channelTitle || '',
          images: imageUrl ? [{ url: imageUrl }] : [],
        },
        duration_ms: 0,
        preview_url: null,
      });
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  return allTracks;
}

export async function fetchSoundCloudPlaylistTracks(playlistId: string, token: string | null): Promise<Track[]> {
  if (!token) return [];

  try {
    const response: Response = await fetch(
      `https://api.soundcloud.com/playlists/${playlistId}?representation=compact`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: 'application/json; charset=utf-8',
        },
      }
    );

    if (!response.ok) return [];

    const data: any = await response.json();
    const tracks: Track[] = [];

    for (const item of data.tracks || []) {
      if (!item || !item.id) continue;

      let artworkUrl = item.artwork_url || '';
      if (artworkUrl) {
        artworkUrl = artworkUrl.replace('-large', '-t500x500');
      }

      tracks.push({
        id: `soundcloud-${item.id}`,
        platform: 'soundcloud',
        name: item.title || 'Unknown Track',
        uri: item.permalink_url || '',
        artists: [{ name: item.user?.username || 'Unknown Artist' }],
        album: {
          name: item.user?.username || 'Unknown Artist',
          images: artworkUrl ? [{ url: artworkUrl }] : [],
        },
        duration_ms: item.duration || 0,
        preview_url: item.stream_url || null,
      });
    }

    return tracks;
  } catch (error) {
    console.error('SoundCloud playlist tracks error:', error);
    return [];
  }
}
