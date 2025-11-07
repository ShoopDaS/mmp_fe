// Configuration
const BACKEND_URL = "http://127.0.0.1:8080";

// State
let accessToken = "";
let sessionToken = "";
let spotifyPlayer = null;
let deviceId = null;
let currentTrackUri = null;
let isPremium = false;
let isPlayerReady = false;

// Elements
const authSection = document.getElementById("authSection");
const searchSection = document.getElementById("searchSection");
const loginBtn = document.getElementById("loginBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultsContainer");
const playerStatus = document.getElementById("playerStatus");
const nowPlaying = document.getElementById("nowPlaying");
const playPauseBtn = document.getElementById("playPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");

// Initialize Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
  console.log("Spotify SDK Ready");
};

async function initializePlayer() {
  if (!accessToken || spotifyPlayer) return;

  // Check if user has premium
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await response.json();
    isPremium = userData.product === "premium";

    document.getElementById("playbackType").textContent = isPremium
      ? "Premium Playback"
      : "Preview Mode (30s)";
  } catch (error) {
    console.error("Error checking user account:", error);
  }

  if (!isPremium) {
    console.log("Free account - using preview mode");
    playerStatus.classList.remove("hidden");
    document.getElementById("playerStatusText").textContent =
      "Preview Mode (Free Account)";
    document.getElementById("playerStatusIcon").className =
      "w-2 h-2 bg-yellow-500 rounded-full";
    return;
  }

  // Initialize Web Playback SDK for Premium users
  spotifyPlayer = new Spotify.Player({
    name: "MultiMusic Platform",
    getOAuthToken: (cb) => {
      cb(accessToken);
    },
    volume: 0.5,
  });

  // Error handling
  spotifyPlayer.addListener("initialization_error", ({ message }) => {
    console.error("Init Error:", message);
  });

  spotifyPlayer.addListener("authentication_error", ({ message }) => {
    console.error("Auth Error:", message);
    localStorage.removeItem("spotify_session");
    location.reload();
  });

  spotifyPlayer.addListener("account_error", ({ message }) => {
    console.error("Account Error:", message);
  });

  // Ready
  spotifyPlayer.addListener("ready", ({ device_id }) => {
    console.log("Ready with Device ID", device_id);
    deviceId = device_id;
    isPlayerReady = true;
    playerStatus.classList.remove("hidden");
    document.getElementById("playerStatusText").textContent =
      "Spotify Player Ready";
  });

  // Player state changed
  spotifyPlayer.addListener("player_state_changed", (state) => {
    if (!state) return;
    updateNowPlaying(state);
  });

  // Connect
  spotifyPlayer.connect();
}

// Update Now Playing UI
function updateNowPlaying(state) {
  const track = state.track_window.current_track;

  document.getElementById("nowPlayingImage").src = track.album.images[0].url;
  document.getElementById("nowPlayingTitle").textContent = track.name;
  document.getElementById("nowPlayingArtist").textContent = track.artists
    .map((a) => a.name)
    .join(", ");

  nowPlaying.classList.remove("hidden");

  // Update play/pause icon
  if (state.paused) {
    playPauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  } else {
    playPauseIcon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
  }

  // Update progress
  const progress = (state.position / state.duration) * 100;
  document.getElementById("progressBar").style.width = progress + "%";
  document.getElementById("currentTime").textContent = formatTime(
    state.position
  );
  document.getElementById("duration").textContent = formatTime(state.duration);
}

// Format time in mm:ss
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Play/Pause toggle
playPauseBtn.addEventListener("click", () => {
  if (spotifyPlayer) {
    spotifyPlayer.togglePlay();
  }
});

// Play track
async function playTrack(uri, previewUrl) {
  if (isPremium && isPlayerReady && deviceId) {
    // Premium: Play full track via Web Playback SDK
    try {
      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [uri] }),
        }
      );
      currentTrackUri = uri;
    } catch (error) {
      console.error("Playback error:", error);
      alert(
        "Error playing track. Make sure Spotify is not playing on another device."
      );
    }
  } else {
    // Free: Play 30-second preview
    if (!previewUrl || previewUrl === "null") {
      alert("No preview available for this track");
      return;
    }

    // Stop current preview if playing
    if (window.currentPreviewAudio) {
      window.currentPreviewAudio.pause();
    }

    // Play preview
    window.currentPreviewAudio = new Audio(previewUrl);
    window.currentPreviewAudio.play();
  }
}

// Check for session token in URL (returned from backend)
async function checkForSession() {
  const params = new URLSearchParams(window.location.search);
  const session = params.get("session");

  if (session) {
    // Got session token from backend
    sessionToken = session;
    localStorage.setItem("spotify_session", session);

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Get access token from backend using session
    await getAccessToken(session);

    showSearchSection();
    initializePlayer();
  } else {
    // Check localStorage for existing session
    const storedSession = localStorage.getItem("spotify_session");
    if (storedSession) {
      sessionToken = storedSession;
      await getAccessToken(storedSession);
      showSearchSection();
      initializePlayer();
    }
  }
}

// Get access token from backend
async function getAccessToken(session) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/spotify/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
    });

    const data = await response.json();
    if (data.accessToken) {
      accessToken = data.accessToken;
    } else {
      // Session expired, need to login again
      localStorage.removeItem("spotify_session");
      location.reload();
    }
  } catch (error) {
    console.error("Error getting access token:", error);
    localStorage.removeItem("spotify_session");
    location.reload();
  }
}

function showSearchSection() {
  authSection.classList.add("hidden");
  searchSection.classList.remove("hidden");
}

// Login handler - simplified without client ID input
loginBtn.addEventListener("click", async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/spotify/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (data.authUrl) {
      // Redirect to Spotify OAuth
      window.location.href = data.authUrl;
    } else {
      alert("Failed to initiate login");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert(
      "Failed to connect to backend. Make sure it is running on http://127.0.0.1:8080"
    );
  }
});

// Search handler
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = await response.json();
    displayResults(data.tracks.items);
  } catch (error) {
    alert("Search failed. Your token might have expired. Please login again.");
    console.error(error);
    localStorage.removeItem("spotify_session");
    location.reload();
  }
}

searchBtn.addEventListener("click", performSearch);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") performSearch();
});

// Display results
function displayResults(tracks) {
  if (tracks.length === 0) {
    resultsContainer.innerHTML = `
                    <div class="text-center py-12 text-gray-400">
                        <p>No results found</p>
                    </div>
                `;
    return;
  }

  resultsContainer.innerHTML = tracks
    .map((track) => {
      const albumImage = track.album.images[2]?.url || "";
      const artists = track.artists.map((a) => a.name).join(", ");

      return `
                    <div class="bg-gray-800 hover:bg-gray-750 rounded-lg p-4 flex items-center gap-4 transition">
                        <div class="flex-shrink-0">
                            ${
                              albumImage
                                ? `<img src="${albumImage}" alt="${track.album.name}" class="w-16 h-16 rounded">`
                                : `<div class="w-16 h-16 bg-gray-700 rounded flex items-center justify-center">
                                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                                    </svg>
                                </div>`
                            }
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-semibold truncate">${
                              track.name
                            }</h3>
                            <p class="text-gray-400 text-sm truncate">${artists}</p>
                            <p class="text-gray-500 text-xs truncate">${
                              track.album.name
                            }</p>
                        </div>
                        <button
                            onclick="playTrack('${track.uri}', '${
        track.preview_url
      }')"
                            class="flex-shrink-0 p-3 rounded-full transition bg-green-600 hover:bg-green-700"
                        >
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                `;
    })
    .join("");
}

// Make playTrack global
window.playTrack = playTrack;

// Initialize
checkForSession();
