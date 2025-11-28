# Radio Calico - Live Streaming Web Application

A full-featured live radio streaming web application with HLS audio streaming, real-time metadata, listener analytics, song ratings, and request management. Features a professional design following the Radio Calico brand style guide with a modern horizontal layout.

## Features

### 🎵 Core Features
- **Live HLS Audio Streaming** - High-quality audio streaming with HLS.js support
- **Real-time Metadata** - Displays currently playing song, artist, album, and cover art
- **Recently Played Tracks** - Shows the last 5 songs that were played
- **Audio Quality Indicators** - Displays bit depth, sample rate, and content flags (Explicit, New)

### 👍 Rating System
- **Song Voting** - Users can vote thumbs up or thumbs down on songs
- **Vote Changes** - Users can change their vote from thumbs up to thumbs down (and vice versa)
- **Persistent User Identification** - Votes are tracked per user without requiring login
  - Server-side fingerprinting based on IP address, User-Agent, and browser headers
  - Client-side fingerprinting as backup using canvas, screen, and browser properties
  - Combined approach ensures one vote per user per song across sessions

### 📊 Analytics & Tracking
- **Listener Statistics** - Track total listeners and listening time
- **Session Management** - Monitor active listening sessions with duration tracking
- **Song Rating Analytics** - View aggregated thumbs up/down counts per song

### 🎤 User Engagement
- **Song Requests** - Users can request songs with optional messages
- **Feedback System** - Collect user feedback with ratings (1-5 stars)
- **Request Management** - Approve, reject, or mark requests as played

## Design & Branding

### Radio Calico Brand Identity

The application follows the official **Radio Calico Style Guide** with a cohesive brand identity:

#### Color Palette
- **Mint** (#D8F2D5) - Background accents and footer
- **Forest Green** (#1F4E23) - Primary buttons and headings
- **Teal** (#38A29D) - Navigation and interactive elements
- **Calico Orange** (#EFA63C) - Call-to-action highlights
- **Charcoal** (#231F20) - Body text and icons
- **Cream** (#F5EADA) - Secondary backgrounds
- **White** (#FFFFFF) - Text on dark backgrounds

#### Typography
- **Headings:** Montserrat (500-700 weight)
- **Body Text:** Open Sans (400-600 weight)
- **Fallback Stack:** System fonts for optimal performance

#### Logo
Features the iconic Radio Calico logo: a calico cat wearing headphones on a mint green circular background, with a forest green border.

### User Interface Layout

The application uses a modern **horizontal two-column layout**:

#### Header (Full-width)
- Dark gray (#555) background spanning full viewport width
- Centered logo (50px circular) and "Radio Calico" title
- Clean, professional navigation bar appearance

#### Main Content (Two Columns)
**Left Column - Album Display:**
- Large 540×540px album artwork
- Dynamic year badge (top-right corner, diagonal red accent)
- Year extracted from song title metadata
- High-quality shadow effects

**Right Column - Track Information:**
- Large artist name (56px Montserrat Bold)
- Song title (42px Montserrat SemiBold)
- Album name (20px Open Sans)
- Source quality indicator (updates per track)
- Stream quality display (constant 48kHz FLAC/HLS)
- Rating interface with thumbs up/down emojis
- Compact player controls (dark gray bar)

#### Player Controls
- Minimalist dark gray bar (#4A4A4A)
- Play/Pause button
- Live time display (format: "0:35 / Live")
- Volume slider with speaker icon
- No bulky cards or excessive padding

#### Footer (Full-width)
- Mint green (#D8F2D5) background
- "Previous tracks:" heading (24px Montserrat SemiBold)
- Simple list format: **Artist:** *Song Title*
- Recently played tracks from metadata

### Responsive Design
- Desktop: Full horizontal two-column layout
- Tablet (< 1200px): Reduced album art size, adjusted typography
- Mobile (< 968px): Stacks vertically, centered album art
- Maintains brand colors and readability at all sizes

## Tech Stack

- **Runtime:** Node.js v22.16.0
- **Web Framework:** Express.js
- **Database:** SQLite with better-sqlite3
- **Audio Streaming:** HLS.js
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Auto-reload:** Nodemon (development)

## Prerequisites

- Node.js 22+ installed
- npm or yarn package manager
- (Optional) Docker Desktop for containerized deployment

## Quick Start

### Local Development (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - Open your browser to: http://localhost:3000
   - The server will automatically reload when you make changes (via nodemon)

### Docker Deployment

1. **Start the application:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Open your browser to: http://localhost:3000

3. **Stop the server:**
   ```bash
   docker-compose down
   ```

## Project Structure

```
Radio/
├── server.js                      # Main Express server & API endpoints
├── package.json                   # Node.js dependencies
├── radio.db                       # SQLite database (auto-created)
├── public/
│   ├── index.html                # Radio player frontend (HTML)
│   ├── styles.css                # RadioCalico brand stylesheet
│   └── RadioCalicoLogoTM.png     # Brand logo image
├── RadioCalico_Style_Guide.txt    # Official brand style guide
├── RadioCalicoLayout.png          # Reference layout mockup
├── RadioCalicoLogoTM.png          # Logo source file
├── Dockerfile                     # Docker container configuration
├── docker-compose.yml             # Docker orchestration
├── stream_URL.txt                # HLS stream URL
├── CLAUDE.md                      # Development instructions
└── README.md                      # This file
```

## API Documentation

### Health Check
- `GET /api/health` - Server health check

### Listener Management
- `POST /api/listeners` - Register or update a listener session
  - Body: `{ session_id: string }`
- `GET /api/listeners/stats` - Get total listener statistics

### Listening Sessions
- `POST /api/sessions/start` - Start a new listening session
  - Body: `{ session_id: string }`
- `POST /api/sessions/end` - End a listening session
  - Body: `{ session_id: string, listening_session_id: number }`

### Song Ratings
- `POST /api/ratings` - Submit or update a song rating
  - Body: `{ song_id: string, session_id: string, rating: 1 | -1 }`
  - Returns: `{ thumbs_up: number, thumbs_down: number, user_rating: number }`
- `GET /api/ratings/:song_id` - Get ratings for a specific song
  - Query: `?session_id=string` (optional)
  - Returns: `{ song_id: string, thumbs_up: number, thumbs_down: number, user_rating: number | null }`

### Song Requests
- `POST /api/requests` - Submit a song request
  - Body: `{ listener_name: string, song_title: string, artist: string, message: string }`
- `GET /api/requests` - Get song requests (filtered by status)
  - Query: `?status=pending|approved|played|rejected` (default: pending)
- `PATCH /api/requests/:id` - Update request status
  - Body: `{ status: 'pending' | 'approved' | 'played' | 'rejected' }`

### Feedback
- `POST /api/feedback` - Submit user feedback
  - Body: `{ listener_name: string, email: string, message: string, rating: 1-5 }`
- `GET /api/feedback` - Get all feedback
- `GET /api/feedback/rating` - Get average feedback rating

## Database Schema

### listeners
- Tracks unique listeners by session ID
- Fields: id, session_id, first_connected, last_connected, total_listening_time

### listening_sessions
- Tracks individual listening sessions with duration
- Fields: id, listener_id, started_at, ended_at, duration

### song_ratings
- Stores user votes (thumbs up/down) with fingerprint-based deduplication
- Fields: id, song_id, session_id, ip_address, user_fingerprint, rating, created_at
- **Unique constraint:** One vote per user_fingerprint per song_id

### song_requests
- Stores user song requests
- Fields: id, listener_name, song_title, artist, message, status, created_at

### feedback
- Stores user feedback and ratings
- Fields: id, listener_name, email, message, rating, created_at

## Configuration

### Stream URL
The HLS stream URL is configured in:
- **Frontend:** `public/index.html` (JavaScript section, `streamUrl` constant)
- **Reference:** `stream_URL.txt`

Current stream: `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`

### Metadata URL
Metadata is fetched from: `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`

The metadata includes:
- **Track info:** title, artist, album
- **Audio quality:** bit_depth, sample_rate
- **Content flags:** is_explicit, is_new
- **Recently played:** prev_artist_1-5, prev_title_1-5

Metadata is automatically fetched every 5 seconds while the player is active and updates:
- Artist name, song title, album name
- Album artwork (with cache-busting)
- Source quality (bit depth and sample rate from original file)
- Year badge (extracted from title if present in format "Title (Year)")
- Recently played tracks in the footer

### Frontend Styling
The frontend uses a modular CSS architecture:
- **`public/styles.css`** - Contains all Radio Calico brand styles
- **Google Fonts** - Montserrat and Open Sans loaded via CDN
- **CSS Variables** - Brand colors, spacing, and typography defined in `:root`
- **Responsive breakpoints:** 1200px, 968px, 640px

### Server Port
Default port: 3000 (configurable via `PORT` environment variable)

## User Identification System

The application uses a **dual-layer fingerprinting system** to ensure users can only vote once per song without requiring login:

### Server-Side Fingerprinting
The server generates a SHA-256 hash from:
- Client IP address
- User-Agent header
- Accept-Language header
- Accept-Encoding header

### Client-Side Fingerprinting
The frontend generates a fingerprint using:
- Canvas fingerprinting
- User-Agent string
- Screen resolution and color depth
- Timezone and offset
- Hardware concurrency
- Device memory
- Installed plugins
- Touch support detection

This combined approach ensures:
- ✅ One vote per user per song
- ✅ Votes persist across browser sessions
- ✅ No login required
- ✅ Privacy-friendly (hashed fingerprints)
- ✅ Resistant to cookie deletion

## Database Migrations

The application includes automatic database migrations that run on server startup:
- Adds missing columns to existing tables
- Removes conflicting unique constraints
- Preserves existing data during schema updates
- Creates necessary indexes for performance

To reset the database:
```bash
# Stop the server
# Delete the database file
rm radio.db
# Restart the server
npm start
```

## Development

### Making Changes

1. Edit files in the project directory
2. The server automatically reloads (thanks to nodemon)
3. Database changes persist in `radio.db`
4. Frontend changes are immediately reflected (static file serving)

### Customizing the Design

The Radio Calico design can be customized by editing:

**Brand Colors (`public/styles.css`):**
```css
:root {
    --mint: #D8F2D5;
    --forest-green: #1F4E23;
    --teal: #38A29D;
    --calico-orange: #EFA63C;
    /* ... modify these values ... */
}
```

**Typography:**
- Change font families in the CSS `@import` statement
- Update `--font-heading` and `--font-body` CSS variables

**Layout Dimensions:**
- Album art size: `.album-art-container` width/height
- Max content width: `--max-width` CSS variable (default 1400px)
- Responsive breakpoints: `@media` queries at bottom of CSS

**Logo:**
Replace `public/RadioCalicoLogoTM.png` with your own logo (recommended: 512×512px PNG with transparency)

### Adding Dependencies

```bash
npm install package-name
```

For Docker:
```bash
docker-compose down
docker-compose up --build
```

### Database Management

View/edit the SQLite database using:
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [SQLite CLI](https://sqlite.org/cli.html)
- VS Code extensions (SQLite Viewer)

### Logging

The server logs include:
- Vote submissions and changes
- Database migration status
- HLS streaming events
- API request/response status

Check console output for debugging.

## Deployment Considerations

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Use a reverse proxy (Nginx, Caddy)
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Monitor server logs
- [ ] Set up health check monitoring
- [ ] Consider using a CDN for static assets

### Environment Variables

```bash
PORT=3000                    # Server port
NODE_ENV=production          # Environment mode
```

### Performance Optimization

- The database uses indexes on frequently queried columns
- HLS.js configured for low latency mode
- Metadata fetched every 5 seconds (not every second)
- Vote fingerprints are cached per request

## Troubleshooting

### Port Already in Use
```bash
# Change port in package.json or use environment variable
PORT=3001 npm start
```

### Database Locked Error
- Close any database viewer applications
- Ensure only one server instance is running
- Check file permissions on `radio.db`

### HLS Stream Not Playing
- Check network console for CORS errors
- Verify stream URL is accessible: `curl https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- Try a different browser (Safari has native HLS support)

### Vote Counts Not Updating
- Check browser console for JavaScript errors
- Verify API is responding: `curl http://localhost:3000/api/health`
- Check server logs for database errors

### Metadata Not Updating
- Metadata refreshes every 5 seconds while playing
- Check browser console for fetch errors
- Verify metadata URL is accessible: `curl https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`
- Ensure CORS is properly configured
- Try clicking play/pause to restart metadata fetching

### Migration Errors on Startup
- Backup your database: `cp radio.db radio.db.backup`
- Delete and recreate: `rm radio.db && npm start`
- Check file permissions

## Browser Compatibility

- **Chrome/Edge:** Full support (HLS.js)
- **Firefox:** Full support (HLS.js)
- **Safari:** Native HLS support
- **Mobile browsers:** Fully responsive design with optimized layouts
  - Vertical stacking on screens < 968px
  - Touch-friendly controls and tap targets
  - Maintains brand aesthetics on all screen sizes

## Design Reference Files

The project includes several design reference files:

- **`RadioCalico_Style_Guide.txt`** - Complete brand style guide with:
  - Color palette with hex/RGB values
  - Typography specifications (fonts, sizes, weights)
  - UI component guidelines (buttons, forms, audio controls)
  - Layout and spacing rules
  - Voice and tone guidelines

- **`RadioCalicoLayout.png`** - Reference mockup showing:
  - Ideal two-column layout
  - Header and footer design
  - Album art positioning with year badge
  - Track information hierarchy
  - Player control bar appearance

- **`RadioCalicoLogoTM.png`** - High-resolution brand logo
  - Transparent PNG format
  - Features calico cat with headphones
  - Mint green circular background with forest green border

These files serve as the design foundation for the application and should be consulted when making visual changes.

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Credits

- Built with Express.js and HLS.js
- Uses better-sqlite3 for database management
- Fingerprinting techniques for privacy-preserving user tracking

## Support

For issues or questions:
- Check the console logs
- Review API documentation above
- Check browser developer console
- Verify stream URL is accessible
