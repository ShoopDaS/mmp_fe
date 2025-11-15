/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'i.scdn.co',                    // Spotify
      'lh3.googleusercontent.com',    // Google/YouTube
      'yt3.ggpht.com',               // YouTube thumbnails
      'i.ytimg.com',                  // YouTube thumbnails
      'i1.sndcdn.com',               // SoundCloud images
      'a1.sndcdn.com',               // SoundCloud avatars
    ],
  },
}

module.exports = nextConfig
