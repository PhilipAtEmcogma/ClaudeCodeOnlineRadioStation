# Radio Calico System Architecture

This document provides visual architecture diagrams for the Radio Calico streaming platform.

## Production Architecture (3-Container Setup)

```mermaid
graph TB
    subgraph "External Services"
        CloudFront["CloudFront CDN<br/>d3d4yli4hf5bmh.cloudfront.net"]
        HLS["HLS Stream<br/>/hls/live.m3u8"]
        Metadata["Metadata API<br/>/metadatav2.json"]
        CloudFront --> HLS
        CloudFront --> Metadata
    end

    subgraph "Client Browser"
        UI["User Interface<br/>HTML/CSS/JS"]
        HLSPlayer["HLS.js Player<br/>(self-hosted)"]
        SW["Service Worker<br/>(offline cache)"]
        UI --> HLSPlayer
        UI --> SW
    end

    subgraph "Docker Production Environment"
        subgraph "nginx Container :80"
            Nginx["Nginx 1.25<br/>+ Brotli Compression"]
            StaticFiles["Static Assets<br/>/usr/share/nginx/html"]
            Nginx --> StaticFiles
        end

        subgraph "radio-calico-api Container :3000"
            API["Express API<br/>Node.js 22"]
            DbLayer["db.js<br/>Abstraction Layer"]
            API --> DbLayer
        end

        subgraph "postgres Container :5432"
            PostgreSQL["PostgreSQL 16<br/>Database"]
            PGVolume[("postgres-data<br/>Volume")]
            PostgreSQL --> PGVolume
        end

        Nginx -->|"Reverse Proxy<br/>/api/*"| API
        DbLayer -->|"pg Driver<br/>Async"| PostgreSQL
    end

    UI -->|"HTTPS<br/>Port 80"| Nginx
    UI -->|"WebSocket<br/>(upgrade)"| Nginx
    HLSPlayer -->|"HLS Streaming"| HLS
    UI -->|"Metadata Poll<br/>(5s interval)"| Metadata
    UI -->|"API Requests<br/>(ratings, requests)"| Nginx

    style CloudFront fill:#ff9900,stroke:#232f3e,stroke-width:2px,color:#fff
    style Nginx fill:#009639,stroke:#333,stroke-width:2px,color:#fff
    style API fill:#68a063,stroke:#333,stroke-width:2px,color:#fff
    style PostgreSQL fill:#336791,stroke:#333,stroke-width:2px,color:#fff
    style UI fill:#61dafb,stroke:#333,stroke-width:2px,color:#000
    style SW fill:#4a90e2,stroke:#333,stroke-width:2px,color:#fff
```

### Production Components

**Nginx Container (Port 80 - Public)**
- Serves optimized static assets from `dist/` (Vite build output)
- Brotli + gzip compression (15-20% better compression)
- Reverse proxies `/api/*` to Node.js API
- Security headers (CSP, X-Frame-Options, HSTS)
- 1-year caching for hashed assets

**API Container (Port 3000 - Internal)**
- Express.js REST API
- db.js abstraction layer (auto-converts SQLite → PostgreSQL)
- Rate limiting (100 req/15min general, 10 req/min ratings)
- Input validation (express-validator)
- Security headers (helmet.js)

**PostgreSQL Container (Port 5432 - Internal)**
- PostgreSQL 16 Alpine
- Named volume for persistence
- Health checks every 10s
- Database: `radio`, User: `radio`

**External Services**
- CloudFront CDN: HLS stream + metadata
- Google Fonts: Montserrat + Open Sans (async loaded)

## Development Architecture (1-Container Setup)

```mermaid
graph TB
    subgraph "External Services"
        CloudFront["CloudFront CDN"]
        HLS["HLS Stream"]
        Metadata["Metadata API"]
        CloudFront --> HLS
        CloudFront --> Metadata
    end

    subgraph "Client Browser"
        DevUI["User Interface<br/>HTML/CSS/JS<br/>(hot reload)"]
        DevPlayer["HLS.js Player"]
    end

    subgraph "Docker Dev Container :3000"
        DevExpress["Express Dev Server<br/>+ Nodemon"]
        DevAPI["API Endpoints"]
        DevStatic["Static Files<br/>(public/)"]
        DevDb["db.js Layer"]
        SQLite["SQLite Database<br/>./radio.db"]

        DevExpress --> DevAPI
        DevExpress --> DevStatic
        DevAPI --> DevDb
        DevDb -->|"better-sqlite3<br/>Sync → Async"| SQLite
    end

    DevUI -->|"Port 3000"| DevExpress
    DevPlayer -->|"HLS Streaming"| HLS
    DevUI -->|"Metadata Poll"| Metadata

    style DevExpress fill:#68a063,stroke:#333,stroke-width:2px,color:#fff
    style SQLite fill:#003b57,stroke:#333,stroke-width:2px,color:#fff
    style DevUI fill:#61dafb,stroke:#333,stroke-width:2px,color:#000
```

### Development Features
- Single container (node:22-alpine)
- SQLite database (file: `./radio.db`)
- Volume mount for hot-reload
- Nodemon auto-restart on `server.js` changes
- Express serves both API and static files

## Database Schema

```mermaid
erDiagram
    listeners {
        int id PK
        string ip_address
        string user_agent
        timestamp created_at
    }

    listening_sessions {
        int id PK
        int listener_id FK
        timestamp started_at
        timestamp ended_at
        int duration_seconds
    }

    song_requests {
        int id PK
        int listener_id FK
        string artist
        string title
        string message
        timestamp requested_at
    }

    feedback {
        int id PK
        int listener_id FK
        string message
        int rating
        timestamp submitted_at
    }

    song_ratings {
        int id PK
        string song_id
        int session_id
        int rating
        string user_fingerprint
        timestamp created_at
        timestamp updated_at
    }

    listeners ||--o{ listening_sessions : "has many"
    listeners ||--o{ song_requests : "submits"
    listeners ||--o{ feedback : "provides"
```

### Schema Notes
- **song_ratings**: Unique index on `(song_id, user_fingerprint)` prevents duplicate votes
- **user_fingerprint**: SHA-256 hash (IP + User-Agent + Accept-Language + Accept-Encoding)
- **SQLite → PostgreSQL differences**: Auto-handled by db.js abstraction layer

## Data Flow Diagrams

### Song Rating Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Nginx
    participant API
    participant Fingerprint
    participant Database

    User->>Frontend: Click thumbs up/down
    Frontend->>Frontend: Generate client fingerprint<br/>(lazy, cached)
    Frontend->>Nginx: POST /api/ratings<br/>{song_id, session_id, rating}
    Nginx->>API: Proxy request
    API->>Fingerprint: Generate server fingerprint<br/>SHA-256(IP + UA + headers)
    API->>Database: Check existing vote<br/>WHERE song_id + fingerprint

    alt Same vote (no change)
        Database-->>API: Return existing
        API-->>Nginx: 200 + current counts
    else Different vote (update)
        Database-->>API: UPDATE rating
        API-->>Nginx: 200 + updated counts
    else New vote (insert)
        Database-->>API: INSERT new rating
        API-->>Nginx: 200 + updated counts
    end

    Nginx-->>Frontend: JSON response<br/>{thumbs_up, thumbs_down, user_vote}
    Frontend->>Frontend: Update UI icons
```

### Metadata Update Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant CloudFront
    participant PageVisibility

    User->>Frontend: Visit page
    Frontend->>Frontend: Start 5s polling interval

    loop Every 5 seconds (if playing)
        PageVisibility->>Frontend: Check tab visibility

        alt Tab visible
            Frontend->>CloudFront: GET /metadatav2.json
            CloudFront-->>Frontend: {title, artist, album,<br/>bit_depth, sample_rate,<br/>recent_tracks[]}
            Frontend->>Frontend: Update UI<br/>Extract year badge<br/>Fetch album art
        else Tab hidden
            Frontend->>Frontend: Skip poll<br/>(save 50-90% API calls)
        end
    end

    User->>Frontend: Pause playback
    Frontend->>Frontend: Stop polling
```

### HLS Streaming Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant HLSjs
    participant ServiceWorker
    participant CloudFront

    User->>Browser: Click Play button

    alt Safari/iOS (native HLS)
        Browser->>CloudFront: Load .m3u8 playlist
        CloudFront-->>Browser: Playlist + segments
        Browser->>Browser: Native HLS playback
    else Chrome/Firefox (HLS.js)
        Browser->>HLSjs: Initialize player
        HLSjs->>CloudFront: Load .m3u8 playlist
        CloudFront-->>HLSjs: Playlist
        HLSjs->>CloudFront: Fetch media segments
        CloudFront-->>HLSjs: .ts segments
        HLSjs->>Browser: Decode + play audio
    end

    Browser->>ServiceWorker: Check cache
    ServiceWorker-->>Browser: Cached assets<br/>(JS, CSS, images)

    Note over Browser,ServiceWorker: Repeat visits <100ms<br/>(90% faster)
```

## Performance Optimization Architecture

### Build Pipeline

```mermaid
graph LR
    subgraph "Source Files (public/)"
        HTML["index.html<br/>6.1KB"]
        JS["app.js<br/>~540 lines"]
        CSS["styles.css<br/>7.6KB"]
        IMG["Images<br/>PNG + SVG"]
    end

    subgraph "Build Process (Vite)"
        Minify["Terser Minification<br/>-58% JS, -29% CSS"]
        Split["Code Splitting<br/>app.js + hls.js"]
        Hash["Asset Hashing<br/>[name].[hash].ext"]
        Compress["Brotli + Gzip"]
        OptIMG["Image Optimization<br/>Sharp"]

        HTML --> Minify
        JS --> Minify
        JS --> Split
        CSS --> Minify
        IMG --> OptIMG

        Minify --> Hash
        Split --> Hash
        Hash --> Compress
    end

    subgraph "Build Output (dist/)"
        MainJS["main.[hash].js<br/>7.3KB (3.2KB gzip)"]
        HLSJS["hls.[hash].js<br/>517KB (157KB gzip)"]
        StyleCSS["styles.[hash].css<br/>5.3KB (1.6KB gzip)"]
        IndexHTML["index.html<br/>+ Critical CSS inline"]
        OptPNG["RadioCalicoLogoTM.png<br/>19KB (64.5% smaller)"]
        WebP["RadioCalicoLogoTM.webp<br/>33KB (40% smaller)"]

        Split --> MainJS
        Split --> HLSJS
        Minify --> StyleCSS
        Minify --> IndexHTML
        OptIMG --> OptPNG
        OptIMG --> WebP
    end

    style Minify fill:#f39c12,stroke:#333,stroke-width:2px
    style Split fill:#e74c3c,stroke:#333,stroke-width:2px
    style Hash fill:#9b59b6,stroke:#333,stroke-width:2px
    style Compress fill:#3498db,stroke:#333,stroke-width:2px,color:#fff
```

### Resource Loading Strategy

```mermaid
graph TB
    subgraph "Initial Page Load"
        DNS1["Preconnect to<br/>CloudFront + Google Fonts<br/>(saves 100-300ms)"]
        Critical["Critical CSS inline<br/>1.6KB in &lt;head&gt;<br/>(instant render)"]
        HTML["HTML parsed"]

        HTML --> DNS1
        HTML --> Critical
    end

    subgraph "Deferred Resources"
        MainJS["main.js<br/>(defer)"]
        StylesCSS["styles.css<br/>(async)"]
        Fonts["Google Fonts<br/>(async, media=print → all)"]
        SW["Service Worker<br/>(after page load)"]

        Critical -.->|"non-blocking"| StylesCSS
        HTML -.->|"defer"| MainJS
        HTML -.->|"async"| Fonts
        MainJS --> SW
    end

    subgraph "Lazy Loading"
        HLSJS["hls.js chunk<br/>(loaded on Play)"]
        Fingerprint["Fingerprint generation<br/>(loaded on vote)"]
        AlbumArt["Album art<br/>(loaded per song)"]

        MainJS -.->|"import()"| HLSJS
        MainJS -.->|"import()"| Fingerprint
    end

    subgraph "Service Worker Cache"
        Precache["Precache Strategy<br/>JS, CSS, fonts, images"]
        Runtime["Runtime Cache<br/>API responses, metadata"]

        SW --> Precache
        SW --> Runtime
    end

    style Critical fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style SW fill:#3498db,stroke:#333,stroke-width:2px,color:#fff
    style Precache fill:#16a085,stroke:#333,stroke-width:2px,color:#fff
```

## Security Architecture

### Request Security Pipeline

```mermaid
graph TB
    Request["Incoming Request"]

    subgraph "Nginx Layer"
        CSP["Content Security Policy<br/>CloudFront + self only"]
        Headers["Security Headers<br/>X-Frame, HSTS, X-XSS"]
        Compress["Brotli Compression"]

        Request --> CSP
        CSP --> Headers
        Headers --> Compress
    end

    subgraph "Express Middleware"
        Helmet["Helmet.js<br/>Additional headers"]
        CORS["CORS<br/>ALLOWED_ORIGINS check"]
        RateLimit["Rate Limiting<br/>100/15min general<br/>10/1min ratings"]
        Validation["Input Validation<br/>express-validator<br/>trim, length, whitelist"]

        Compress --> Helmet
        Helmet --> CORS
        CORS --> RateLimit
        RateLimit --> Validation
    end

    subgraph "API Layer"
        Fingerprint["Server Fingerprint<br/>SHA-256(IP + headers)"]
        Parameterized["Parameterized Queries<br/>? placeholders"]
        ErrorSanitize["Error Sanitization<br/>(prod: no stack traces)"]

        Validation --> Fingerprint
        Fingerprint --> Parameterized
        Parameterized --> ErrorSanitize
    end

    subgraph "Database Layer"
        DbAbstraction["db.js Abstraction<br/>Auto-escapes params"]
        Database[("PostgreSQL/SQLite")]

        ErrorSanitize --> DbAbstraction
        DbAbstraction --> Database
    end

    Database --> Response["Secure Response"]

    style CSP fill:#e74c3c,stroke:#333,stroke-width:2px,color:#fff
    style RateLimit fill:#e67e22,stroke:#333,stroke-width:2px,color:#fff
    style Validation fill:#f39c12,stroke:#333,stroke-width:2px
    style Parameterized fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
```

### Deduplication Strategy (Song Ratings)

```mermaid
graph TB
    Vote["User Vote Action"]

    subgraph "Client-Side Fingerprint (Optional)"
        Canvas["Canvas Fingerprint"]
        Screen["Screen Resolution"]
        Navigator["Navigator Properties"]
        ClientHash["SHA-256 Hash<br/>(can be bypassed)"]

        Canvas --> ClientHash
        Screen --> ClientHash
        Navigator --> ClientHash
    end

    subgraph "Server-Side Fingerprint (Primary)"
        IP["Client IP Address"]
        UA["User-Agent Header"]
        Lang["Accept-Language"]
        Encoding["Accept-Encoding"]
        ServerHash["SHA-256 Hash<br/>(cannot be bypassed)"]

        IP --> ServerHash
        UA --> ServerHash
        Lang --> ServerHash
        Encoding --> ServerHash
    end

    subgraph "Database Constraint"
        UniqueIndex["UNIQUE INDEX<br/>(song_id, user_fingerprint)"]

        ServerHash --> UniqueIndex
    end

    Vote --> Canvas
    Vote --> IP

    UniqueIndex --> Decision{Existing vote?}
    Decision -->|Same rating| NoChange["Return current counts"]
    Decision -->|Different rating| Update["UPDATE rating"]
    Decision -->|No vote| Insert["INSERT new rating"]

    style ServerHash fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style ClientHash fill:#e67e22,stroke:#333,stroke-width:2px,color:#fff
    style UniqueIndex fill:#3498db,stroke:#333,stroke-width:2px,color:#fff
```

## Deployment Comparison

| Aspect | Development | Production |
|--------|-------------|------------|
| **Containers** | 1 (radio-calico-dev) | 3 (nginx, API, postgres) |
| **Database** | SQLite (./radio.db) | PostgreSQL (volume) |
| **Static Files** | Express (public/) | Nginx (dist/) |
| **Build** | Source files | Vite optimized |
| **Port** | 3000 | 80 (nginx only) |
| **Hot Reload** | Yes (nodemon + mount) | No (immutable) |
| **Compression** | None | Brotli + gzip |
| **Image Size** | ~350MB | ~150MB (API) + 40MB (nginx) |
| **Security** | Basic | Full (CSP, rate limit, headers) |
| **Performance** | Good | Optimized (95-100 Lighthouse) |

## Technology Stack Overview

```mermaid
graph TB
    subgraph "Frontend Technologies"
        Vanilla["Vanilla JavaScript<br/>ES Modules"]
        HTML5["HTML5<br/>Semantic markup"]
        CSS3["CSS3<br/>Grid + Flexbox"]
        HLSLib["HLS.js 1.5.x<br/>Self-hosted"]
        SWLib["Service Worker API<br/>Offline capability"]
    end

    subgraph "Backend Technologies"
        Node["Node.js 22+<br/>LTS"]
        Express["Express 4.x<br/>REST API"]
        BetterSQLite["better-sqlite3<br/>(development)"]
        PG["pg Driver<br/>(production)"]
    end

    subgraph "Build & Optimization"
        Vite["Vite 7.2.4<br/>Build system"]
        Terser["Terser<br/>Minification"]
        Sharp["Sharp<br/>Image optimization"]
        Critical["Critical CSS<br/>Extraction"]
    end

    subgraph "Security & Middleware"
        Helmet["helmet.js<br/>Security headers"]
        RateLimiter["express-rate-limit<br/>DoS protection"]
        Validator["express-validator<br/>Input validation"]
    end

    subgraph "Infrastructure"
        Docker["Docker<br/>Containerization"]
        Nginx["Nginx 1.25<br/>Reverse proxy"]
        PostgresDB["PostgreSQL 16<br/>Database"]
        SQLiteDB["SQLite 3<br/>Development DB"]
    end

    style Node fill:#68a063,stroke:#333,stroke-width:2px,color:#fff
    style PostgresDB fill:#336791,stroke:#333,stroke-width:2px,color:#fff
    style Nginx fill:#009639,stroke:#333,stroke-width:2px,color:#fff
    style Docker fill:#2496ed,stroke:#333,stroke-width:2px,color:#fff
    style Vite fill:#646cff,stroke:#333,stroke-width:2px,color:#fff
```

## External Dependencies

```mermaid
graph LR
    App["Radio Calico<br/>Application"]

    subgraph "CDN Services"
        CloudFront["AWS CloudFront<br/>d3d4yli4hf5bmh.cloudfront.net"]
        HLS["HLS Stream<br/>/hls/live.m3u8<br/>(FLAC 192kHz/24bit)"]
        Meta["Metadata API<br/>/metadatav2.json<br/>(5s polling)"]
        Art["Album Art<br/>/cover.jpg"]

        CloudFront --> HLS
        CloudFront --> Meta
        CloudFront --> Art
    end

    subgraph "Font Services"
        GFonts["Google Fonts API"]
        Montserrat["Montserrat<br/>(headings)"]
        OpenSans["Open Sans<br/>(body text)"]

        GFonts --> Montserrat
        GFonts --> OpenSans
    end

    App -->|"HLS Playback"| CloudFront
    App -->|"Typography<br/>(async)"| GFonts

    style CloudFront fill:#ff9900,stroke:#232f3e,stroke-width:2px,color:#fff
    style GFonts fill:#4285f4,stroke:#333,stroke-width:2px,color:#fff
```

## Performance Metrics

### Load Time Progression

```mermaid
graph LR
    subgraph "Before Optimizations"
        B1["FCP: 1.5-2s"]
        B2["LCP: 2-3s"]
        B3["TTI: 2.5-3.5s"]
        B4["Size: 280KB"]
        B5["Lighthouse: 85"]
    end

    subgraph "After Phase 1-3"
        A1["FCP: 0.5-0.8s<br/>60-70% faster"]
        A2["LCP: 0.8-1.2s<br/>60-70% faster"]
        A3["TTI: 1-1.5s<br/>60% faster"]
        A4["Size: 165KB<br/>41% smaller"]
        A5["Lighthouse: 95-100"]
    end

    subgraph "Repeat Visits (Service Worker)"
        R1["Load: <100ms<br/>90%+ faster"]
        R2["Cached: JS, CSS, fonts"]
        R3["Network: API only"]
    end

    B1 -.->|"Optimizations"| A1
    B2 -.->|"Optimizations"| A2
    B3 -.->|"Optimizations"| A3
    B4 -.->|"Optimizations"| A4
    B5 -.->|"Optimizations"| A5

    A1 -.->|"Service Worker"| R1
    A2 -.->|"Service Worker"| R2
    A3 -.->|"Service Worker"| R3

    style A1 fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style A2 fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style A3 fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style A4 fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style A5 fill:#27ae60,stroke:#333,stroke-width:2px,color:#fff
    style R1 fill:#16a085,stroke:#333,stroke-width:2px,color:#fff
```

---

**Last Updated:** 2025-12-01
**Version:** 1.0
**Maintained By:** Radio Calico Development Team
