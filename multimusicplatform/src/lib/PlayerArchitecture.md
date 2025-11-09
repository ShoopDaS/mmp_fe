# Architecture Diagrams (Unified Player)

```
┌─────────────────────────────────────────────────────┐
│              Your Application                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────┐
│           UnifiedMusicPlayer.tsx                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  UI Layer (300 lines):                              │
│  ┌────────────────────────────────────────────┐    │
│  │  🎚️ Progress Bar (Visual + Clickable)     │    │
│  │  ⏱️  Time Display (Current / Total)         │    │
│  │  ▶️  Play/Pause Button (Platform-colored)  │    │
│  │  🔁  Loop Button (Toggle state)            │    │
│  │  🔊  Volume Slider (0-100%)                │    │
│  │  🎨  Platform Badge (Service indicator)     │    │
│  │  🐛  Debug Button (Inspect state)          │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  State Management:                                   │
│  - isPlaying, currentTime, duration                 │
│  - volume, isLooping                                │
│  - error handling, callbacks                        │
└──────────────────────┬───────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────┐
│              IPlayerAdapter (Interface)              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Contract that ALL platforms must implement:         │
│                                                      │
│  interface IPlayerAdapter {                          │
│    initialize(token): Promise<boolean>              │
│    play(track): Promise<void>                       │
│    pause(): Promise<void>                           │
│    resume(): Promise<void>                          │
│    seek(positionMs): Promise<void>                  │
│    setVolume(volume): Promise<void>                 │
│    setLoop(enabled): Promise<void>                  │
│    getState(): PlayerState                          │
│    onStateChange(callback): void                    │
│    onTrackEnd(callback): void                       │
│    cleanup(): void                                  │
│  }                                                   │
└──────────────────────┬───────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│SpotifyAdapter│ │SoundCloud    │ │YouTubeAdapter│
│   (~200L)    │ │Adapter       │ │   (~200L)    │
│              │ │   (~200L)    │ │              │
├──────────────┤ ├──────────────┤ ├──────────────┤
│Uses:         │ │Uses:         │ │Uses:         │
│- Web Playback│ │- Widget API  │ │- IFrame API  │
│  SDK         │ │              │ │              │
│- HTML5 Audio │ │              │ │              │
│  (fallback)  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

Benefits:
✅ 700 total lines (vs 1,200+)
✅ One component to maintain
✅ Fix once, works everywhere
✅ Add features once
✅ Consistent UI
✅ Easy to add new platforms
```

## Data Flow Diagram

### User Interaction → Platform Action

```
User Action              UI Component           Adapter            Platform API
─────────────────────────────────────────────────────────────────────────────

User drags              UnifiedMusicPlayer
seek bar                       │
    │                          │
    │                     Detect change
    │                          │
    │                    Get new position
    │                          │
    │                          ↓
    │                   adapter.seek(45000)
    │                          │
    │                          │                SpotifyAdapter
    │                          │                      │
    │                          │                Translate to
    │                          │                platform call
    │                          │                      │
    │                          │                      ↓
    │                          │              player.seek(45000)
    │                          │                      │
    │                          │                      │        Spotify SDK
    │                          │                      │              │
    │                          │                      │        Execute seek
    │                          │                      │              │
    │                          │                      ←──────────────┘
    │                          │                      │
    │                          │                Playback
    │                          │                position
    │                          │                updated
    │                          │                      │
    │                          ←──────────────────────┘
    │                          │
    │                   Update UI state
    │                   (progress bar moves)
    │                          │
    ←──────────────────────────┘
Visual feedback
(song jumps to 45s)
```

## State Management Flow

```
┌─────────────────────────────────────────────────────┐
│              Player State (Single Source of Truth)   │
├─────────────────────────────────────────────────────┤
│  {                                                   │
│    isPlaying: boolean         // Play/pause state   │
│    currentTime: number        // Position in ms     │
│    duration: number           // Total length       │
│    volume: number             // 0-1               │
│    isLooping: boolean         // Loop enabled?      │
│    canPlay: boolean           // Ready to play?     │
│  }                                                   │
└────────────┬───────────────────────────────────────┘
             │
             │ State changes propagate to UI
             │
             ↓
┌─────────────────────────────────────────────────────┐
│              UI Updates                              │
├─────────────────────────────────────────────────────┤
│  - Progress bar position                             │
│  - Time display (1:23 / 3:45)                       │
│  - Play/pause icon                                   │
│  - Loop button highlight                             │
│  - Volume slider position                            │
└─────────────────────────────────────────────────────┘

State Updates Flow:
━━━━━━━━━━━━━━━━━

1. Platform SDK detects change
   (e.g., song progresses)
        ↓
2. Adapter receives event
   (via SDK callback)
        ↓
3. Adapter updates internal state
   (this.state.currentTime = newPosition)
        ↓
4. Adapter calls onStateChange callback
   (this.notifyStateChange())
        ↓
5. UI component receives new state
   (setPlayerState(newState))
        ↓
6. React re-renders with new values
   (progress bar updates visually)
```

## Component Lifecycle

```
┌─────────────────────────────────────────────────────┐
│              Component Mount                         │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  1. Determine platform (track.platform)              │
│     if 'spotify' → SpotifyAdapter                    │
│     if 'soundcloud' → SoundCloudAdapter              │
│     if 'youtube' → YouTubeAdapter                    │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  2. Create adapter instance                          │
│     adapter = new SpotifyAdapter()                   │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  3. Register callbacks                               │
│     adapter.onStateChange(updateUI)                  │
│     adapter.onTrackEnd(handleEnd)                    │
│     adapter.onError(showError)                       │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  4. Initialize adapter                               │
│     await adapter.initialize(token)                  │
│     - Loads platform SDK                             │
│     - Creates player instance                        │
│     - Sets up event listeners                        │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  5. Player ready                                     │
│     canPlay = true                                   │
│     UI shows controls                                │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│              Normal Operation                        │
│  - User interacts with controls                      │
│  - Adapter handles platform calls                    │
│  - State updates propagate to UI                     │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│              Component Unmount                       │
│  1. Stop progress tracking                           │
│  2. adapter.cleanup()                                │
│     - Disconnect from platform                       │
│     - Remove event listeners                         │
│     - Free resources                                 │
└─────────────────────────────────────────────────────┘
```

## Adding a New Platform (Step by Step)

```
Step 1: Create Adapter File
━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────┐
│  src/lib/player-adapters/TidalAdapter.ts            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  import { IPlayerAdapter } from './IPlayerAdapter';  │
│                                                      │
│  export class TidalAdapter implements IPlayerAdapter│
│  {                                                   │
│    async initialize(token: string) {                │
│      // Load Tidal SDK                              │
│      // Initialize player                           │
│      return true;                                   │
│    }                                                 │
│                                                      │
│    async play(track: Track) {                       │
│      // Use Tidal API to play                       │
│    }                                                 │
│                                                      │
│    async seek(positionMs: number) {                 │
│      // Use Tidal's seek method                     │
│    }                                                 │
│                                                      │
│    // ... implement all other methods               │
│  }                                                   │
└─────────────────────────────────────────────────────┘
                    ~200 lines

Step 2: Register in Player
━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────┐
│  components/music/UnifiedMusicPlayer.tsx            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  import { TidalAdapter } from '...';                │
│                                                      │
│  switch (track.platform) {                          │
│    case 'spotify':                                  │
│      adapter = new SpotifyAdapter();                │
│      break;                                         │
│    case 'soundcloud':                               │
│      adapter = new SoundCloudAdapter();             │
│      break;                                         │
│    case 'tidal':  // 👈 Add this                   │
│      adapter = new TidalAdapter();                  │
│      break;                                         │
│  }                                                   │
└─────────────────────────────────────────────────────┘
                    ~5 lines added

Step 3: Update Types
━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────┐
│  types/track.ts (or wherever Track is defined)      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  type Platform =                                     │
│    | 'spotify'                                       │
│    | 'soundcloud'                                    │
│    | 'youtube'                                       │
│    | 'tidal';  // 👈 Add this                       │
└─────────────────────────────────────────────────────┘
                    ~1 line added

Step 4: Done! All Features Work
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────┐
│         Tidal Now Has All Features:                  │
├─────────────────────────────────────────────────────┤
│  ✅ Play/Pause                                       │
│  ✅ Seeking                                          │
│  ✅ Looping                                          │
│  ✅ Volume control                                   │
│  ✅ Progress display                                 │
│  ✅ Time display                                     │
│  ✅ Platform badge (add color in getPlatformColor()) │
│  ✅ Error handling                                   │
│  ✅ State management                                 │
└─────────────────────────────────────────────────────┘

Total effort: ~200 lines + 6 lines = ONE adapter file!
```

## File Dependency Graph

```
┌────────────────────────────────────────────────┐
│  Your Application (e.g., SearchPage)           │
│  - Manages current track                       │
│  - Provides platform token                     │
│  - Handles track selection                     │
└──────────────────┬─────────────────────────────┘
                   │
                   ↓ imports & uses
┌──────────────────────────────────────────────────┐
│  components/music/UnifiedMusicPlayer.tsx         │
│  - Renders UI controls                           │
│  - Manages player state                          │
│  - Delegates to adapter                          │
└────────┬────────────────────┬────────────────────┘
         │                    │
         │ imports            │ imports
         ↓                    ↓
┌─────────────────────┐  ┌──────────────────────────┐
│ IPlayerAdapter.ts   │  │  SpotifyAdapter.ts       │
│ - Interface         │  │  - Implements interface  │
│ - PlayerState type  │←─┤  - Uses Spotify SDK      │
│ - Track type        │  │  - Handles Premium/Free  │
└─────────────────────┘  └──────────────────────────┘
         ↑                    ↑
         │ implements         │ uses
         │                    │
┌────────┴──────────┐  ┌──────┴───────────────────┐
│SoundCloudAdapter  │  │  Spotify Web Playback SDK │
│- Implements       │  │  (external)               │
│- Uses SC Widget   │  └───────────────────────────┘
└───────────────────┘
         ↑
         │ uses
         │
┌────────┴──────────┐
│ SoundCloud Widget │
│ API (external)    │
└───────────────────┘
```

## Request Flow Example: Playing a Song

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       │ Clicks track
       │ in search results
       │
       ↓
┌────────────────────────────────────────┐
│  SearchPage                            │
│  setCurrentTrack({                     │
│    platform: 'spotify',                │
│    uri: 'spotify:track:123',           │
│    ...                                 │
│  })                                    │
└──────┬─────────────────────────────────┘
       │
       │ Passes track + token as props
       │
       ↓
┌────────────────────────────────────────┐
│  UnifiedMusicPlayer                    │
│                                        │
│  useEffect(() => {                     │
│    if (track.platform === 'spotify') { │
│      adapter = new SpotifyAdapter()    │
│    }                                   │
│    adapter.initialize(token)           │
│  }, [])                                │
└──────┬─────────────────────────────────┘
       │
       │ Calls after initialization
       │
       ↓
┌────────────────────────────────────────┐
│  SpotifyAdapter.play(track)            │
│                                        │
│  if (isPremium) {                      │
│    playPremium(track)                  │
│  } else {                              │
│    playPreview(track)                  │
│  }                                     │
└──────┬─────────────────────────────────┘
       │
       ↓
┌────────────────────────────────────────┐
│  Spotify Web Playback SDK              │
│  or                                    │
│  HTML5 Audio Element                   │
│                                        │
│  → Music plays!                        │
│                                        │
│  → State updates start flowing         │
│    (progress, time, etc.)              │
└────────────────────────────────────────┘
```

## Summary

The unified player architecture provides:

1. **Separation of Concerns**
   - UI in one place
   - Platform logic in adapters
   - Clean interfaces

2. **Flexibility**
   - Easy to add platforms
   - Easy to add features
   - Easy to modify

3. **Maintainability**
   - Fix bugs once
   - Update features once
   - Test once

4. **Consistency**
   - Same UI everywhere
   - Same behavior everywhere
   - Better UX

5. **Type Safety**
   - Interface enforces contract
   - TypeScript catches errors
   - Better developer experience

This is why a unified player is the superior choice! 🎯