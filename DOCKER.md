# Docker Deployment Guide for Radio Calico

This guide explains how to deploy Radio Calico using Docker in both development and production environments.

## Architecture Overview

Radio Calico uses **different architectures for development and production**:

### Development Architecture (Single Container)
- **Database:** SQLite (file-based, simple)
- **Backend:** Express.js serves both API and static files
- **Container:** Single `radio-calico-dev` container
- **Access:** http://localhost:3000

### Production Architecture (Three Containers)
- **Database:** PostgreSQL (robust, scalable, separate container)
- **Backend:** Express.js API only (no static files)
- **Web Server:** Nginx serves static files + reverse proxies API requests
- **Containers:** `postgres`, `radio-calico-api`, `nginx`
- **Access:** http://localhost:80 (or custom port)

**Why different architectures?**
- **Development:** SQLite is simple, requires no setup, perfect for local development
- **Production:** PostgreSQL is production-grade, handles concurrent connections better, nginx provides superior static file performance and security

## Prerequisites

- Docker Desktop for Windows (version 28.1.1 or later)
- Docker Compose (included with Docker Desktop)
- 4GB free disk space for images and volumes (increased for PostgreSQL)

## Quick Start

### Development Mode
```bash
# Build and start development server
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Production Mode
```bash
# Build and start production servers (PostgreSQL + API + Nginx)
docker-compose -f docker-compose.prod.yml up --build -d

# View logs for all services
docker-compose -f docker-compose.prod.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f radio-calico-api
docker-compose -f docker-compose.prod.yml logs -f postgres

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove database volume (DANGER: deletes all data)
docker-compose -f docker-compose.prod.yml down -v
```

## Docker Files Overview

This project includes multiple Docker configurations for different use cases:

### Dockerfiles

- **`Dockerfile`** - Legacy development file (backwards compatible)
- **`Dockerfile.dev`** - Development optimized (hot-reloading with nodemon)
- **`Dockerfile.prod`** - Production optimized (multi-stage build, security hardened)

### Docker Compose Files

- **`docker-compose.yml`** - Development environment configuration
- **`docker-compose.prod.yml`** - Production environment configuration

## Development Environment

### Features
- **Hot-reloading**: Code changes automatically restart the server (nodemon)
- **Volume mounting**: Local files sync with container for live editing
- **Full debugging**: All devDependencies installed
- **Database persistence**: SQLite database persists in project directory

### Starting Development Server

```bash
# Using docker-compose (recommended)
docker-compose up --build

# Or using standalone Docker
docker build -f Dockerfile.dev -t radio-calico:dev .
docker run -p 3000:3000 -v ${PWD}:/app -v /app/node_modules radio-calico:dev
```

### Development Workflow

1. Start the container: `docker-compose up`
2. Edit files locally in your code editor
3. Nodemon automatically restarts the server on changes
4. Access the app at http://localhost:3000
5. Stop with `Ctrl+C` or `docker-compose down`

### Accessing the Container

```bash
# Open a shell in the running container
docker-compose exec radio-calico-dev sh

# View real-time logs
docker-compose logs -f radio-calico-dev

# Restart the service
docker-compose restart radio-calico-dev
```

## Production Environment

### Features
- **Three-service architecture**: PostgreSQL database, Node.js API, Nginx web server
- **Database:** PostgreSQL 16 (production-grade, concurrent connections, ACID compliance)
- **Web server:** Nginx serves static files with compression and caching
- **Reverse proxy:** Nginx proxies `/api/*` requests to backend
- **Multi-stage build**: Optimized API container (~150MB)
- **Security hardened**: All services run as non-root users
- **Production dependencies only**: No devDependencies in final images
- **Named volumes**: PostgreSQL data persists in Docker-managed volume
- **Health checks**: All three services have health monitoring
- **Restart policy**: All services automatically restart on failure
- **Environment variables**: Configure via `.env` file or docker-compose.prod.yml

### Building Production Image

```bash
# Using docker-compose (recommended)
docker-compose -f docker-compose.prod.yml build

# Or using standalone Docker
docker build -f Dockerfile.prod -t radio-calico:prod .
```

### Running Production Container

```bash
# Start in detached mode
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop and remove containers
docker-compose -f docker-compose.prod.yml down
```

### Production Deployment Checklist

- [ ] **Configure environment variables:** Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`
- [ ] **Build production images:** `docker-compose -f docker-compose.prod.yml build`
- [ ] **Start all services:** `docker-compose -f docker-compose.prod.yml up -d`
- [ ] **Verify health checks:** `docker ps` (all three services should show "healthy")
- [ ] **Test nginx web server:** `curl http://localhost/` (should return HTML)
- [ ] **Test API via nginx:** `curl http://localhost/api/health` (should return JSON)
- [ ] **Test direct API access:** `docker-compose -f docker-compose.prod.yml exec radio-calico-api wget -O- http://localhost:3000/api/health`
- [ ] **Test PostgreSQL connection:** `docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U radio`
- [ ] **Check all logs:** `docker-compose -f docker-compose.prod.yml logs`
- [ ] **Configure HTTPS:** Set up SSL certificates for production domain (Let's Encrypt recommended)
- [ ] **Configure firewall:** Allow port 80 (HTTP) and 443 (HTTPS), block port 3000 (API internal only)
- [ ] **Set up database backups:** Schedule regular PostgreSQL backups (see Database Management section)
- [ ] **Monitor resource usage:** `docker stats` to ensure containers have sufficient resources

## Database Management

### Development Database (SQLite)

The SQLite database file (`radio.db`) is stored in your project directory:

```bash
# Location: ./radio.db
# Automatically created on first run
# Persists between container restarts
# Can be backed up/copied like any file

# Backup SQLite database
cp radio.db radio.db.backup

# View database with SQLite CLI
docker-compose exec radio-calico-dev sqlite3 /app/radio.db

# Export data to SQL
docker-compose exec radio-calico-dev sqlite3 /app/radio.db .dump > backup.sql
```

### Production Database (PostgreSQL)

The production database runs in a separate PostgreSQL container with data stored in a Docker volume.

#### PostgreSQL Container Management

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U radio

# Connect to PostgreSQL with psql
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio

# View database tables
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "\dt"

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "SELECT pg_database_size('radio');"
```

#### PostgreSQL Backup and Restore

**Backup PostgreSQL database:**

```bash
# Backup to SQL file (recommended for portability)
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup to compressed SQL file
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup using custom format (faster restore, includes indexes)
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio -Fc radio > backup-$(date +%Y%m%d-%H%M%S).dump
```

**Restore PostgreSQL database:**

```bash
# Restore from SQL file
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio

# Restore from compressed SQL file
gunzip -c backup.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio

# Restore from custom format dump
docker-compose -f docker-compose.prod.yml exec -T postgres pg_restore -U radio -d radio -c < backup.dump
```

**Automated backup script (save as `backup-postgres.sh`):**

```bash
#!/bin/bash
# Automated PostgreSQL backup script
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/radio-backup-$(date +%Y%m%d-%H%M%S).sql.gz"

docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio | gzip > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "radio-backup-*.sql.gz" -mtime +7 -delete
```

#### PostgreSQL Volume Management

```bash
# View volumes
docker volume ls

# Inspect the PostgreSQL data volume
docker volume inspect radio_postgres-data

# Backup volume (raw data files)
docker run --rm -v radio_postgres-data:/data -v ${PWD}:/backup alpine tar czf /backup/postgres-volume-backup.tar.gz -C /data .

# Restore volume (raw data files)
docker run --rm -v radio_postgres-data:/data -v ${PWD}:/backup alpine tar xzf /backup/postgres-volume-backup.tar.gz -C /data
```

#### Database Migration (SQLite to PostgreSQL)

If you have existing SQLite data and want to migrate to PostgreSQL:

```bash
# 1. Export SQLite data
docker-compose exec radio-calico-dev sqlite3 /app/radio.db .dump > sqlite-export.sql

# 2. Convert SQLite SQL to PostgreSQL SQL (manual editing may be needed)
# - Change AUTOINCREMENT to SERIAL
# - Change DATETIME to TIMESTAMP
# - Change INTEGER PRIMARY KEY to SERIAL PRIMARY KEY
# - Remove SQLite-specific pragmas

# 3. Import to PostgreSQL
cat postgres-compatible.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio
```

### Database Configuration

The database type is configured via environment variables:

**Development (SQLite):**
```yaml
environment:
  - DATABASE_TYPE=sqlite
  - DB_PATH=radio.db
```

**Production (PostgreSQL):**
```yaml
environment:
  - DATABASE_TYPE=postgres
  - POSTGRES_HOST=postgres
  - POSTGRES_PORT=5432
  - POSTGRES_DB=radio
  - POSTGRES_USER=radio
  - POSTGRES_PASSWORD=your_secure_password
```

## Environment Variables

### Available Variables

| Variable | Default | Description | Used In |
|----------|---------|-------------|---------|
| `NODE_ENV` | `development` | Node environment (`development` or `production`) | Both |
| `PORT` | `3000` | Server port (internal for production, external for dev) | Both |
| `DATABASE_TYPE` | `sqlite` | Database type (`sqlite` or `postgres`) | Both |
| `DB_PATH` | `radio.db` | SQLite database file path | Development |
| `POSTGRES_HOST` | `localhost` | PostgreSQL hostname | Production |
| `POSTGRES_PORT` | `5432` | PostgreSQL port | Production |
| `POSTGRES_DB` | `radio` | PostgreSQL database name | Production |
| `POSTGRES_USER` | `radio` | PostgreSQL username | Production |
| `POSTGRES_PASSWORD` | (required) | PostgreSQL password | Production |

### Using Environment Variables

**Option 1: `.env` file (recommended for production)**

Create a `.env` file in the project root (use `.env.example` as template):

```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your values
# IMPORTANT: Set a strong POSTGRES_PASSWORD!
```

Example `.env` for production:
```env
NODE_ENV=production
PORT=80
DATABASE_TYPE=postgres
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=radio
POSTGRES_USER=radio
POSTGRES_PASSWORD=your_very_secure_password_here
```

The `.env` file is automatically loaded by docker-compose.

**Option 2: Set in docker-compose.yml**

Already configured in `docker-compose.yml` (dev) and `docker-compose.prod.yml` (production).

**Option 3: Command line override**

```bash
PORT=8080 docker-compose up
```

## Port Configuration

### Development Port (3000)

The development server runs on port **3000** by default:

```yaml
# docker-compose.yml
ports:
  - "3000:3000"  # Host:Container
```

Access at: http://localhost:3000

To change the development port:
```yaml
ports:
  - "8080:3000"  # Access at http://localhost:8080
```

### Production Ports

Production uses a **different architecture** with three containers:

| Service | Internal Port | Exposed Port | Access |
|---------|---------------|--------------|--------|
| Nginx | 80 | 80 (configurable) | http://localhost |
| API | 3000 | Not exposed | Internal only |
| PostgreSQL | 5432 | Not exposed | Internal only |

**Why only nginx is exposed:**
- **Security:** API and database are not directly accessible from outside
- **Performance:** Nginx handles static files efficiently with caching
- **Flexibility:** Nginx can add HTTPS, rate limiting, and other features

To change the production port, edit `docker-compose.prod.yml`:

```yaml
# Expose nginx on port 8080 instead of 80
services:
  nginx:
    ports:
      - "8080:80"
```

Or use environment variable:
```bash
PORT=8080 docker-compose -f docker-compose.prod.yml up -d
```

## Health Checks

All services in both development and production include health checks.

### Development Health Checks

The development container checks the `/api/health` endpoint:

```bash
# View health status
docker ps

# Should show "healthy" in STATUS column
# Container: radio-calico-dev
```

### Production Health Checks

Production has **three separate health checks**:

| Service | Health Check | Interval | Start Period |
|---------|--------------|----------|--------------|
| **PostgreSQL** | `pg_isready -U radio` | 10s | 30s |
| **API** | GET http://localhost:3000/api/health | 30s | 60s |
| **Nginx** | GET http://localhost/health | 30s | 20s |

```bash
# View all health statuses
docker ps

# Should show three containers, all "healthy":
# - radio-postgres
# - radio-calico-api
# - radio-nginx

# Check specific service health
docker inspect radio-postgres | grep -A 10 Health
docker inspect radio-calico-api | grep -A 10 Health
docker inspect radio-nginx | grep -A 10 Health
```

### Health Check Troubleshooting

If a container shows "unhealthy":

```bash
# Check PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U radio

# Check API
docker-compose -f docker-compose.prod.yml exec radio-calico-api wget -O- http://localhost:3000/api/health

# Check Nginx
docker-compose -f docker-compose.prod.yml exec nginx wget -O- http://localhost/health

# View logs for the unhealthy service
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs radio-calico-api
docker-compose -f docker-compose.prod.yml logs nginx
```

## Nginx Configuration (Production Only)

Production uses Nginx as a web server and reverse proxy. The configuration is in `nginx.conf`.

### What Nginx Does

1. **Serves static files** from `/usr/share/nginx/html` (mounted from `./public`)
   - HTML, CSS, JavaScript, images, fonts
   - Adds caching headers for performance (1 year for static assets)
   - Enables gzip compression

2. **Reverse proxies API requests** from `/api/*` to backend on `http://radio-calico-api:3000`
   - Preserves client IP and headers
   - No buffering for real-time responses

3. **Adds security headers**
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block

4. **Provides health check** at `/health` endpoint

### Nginx Configuration Highlights

```nginx
# Static file caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API reverse proxy
location /api/ {
    proxy_pass http://radio_backend;  # backend = radio-calico-api:3000
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Customizing Nginx

To modify nginx configuration:

1. Edit `nginx.conf` in the project root
2. Rebuild and restart: `docker-compose -f docker-compose.prod.yml up -d --build nginx`
3. Check logs: `docker-compose -f docker-compose.prod.yml logs nginx`

Common customizations:
- Add HTTPS/SSL configuration
- Change cache duration
- Add rate limiting
- Configure CORS headers
- Add custom error pages

### Testing Nginx Configuration

```bash
# Test nginx config syntax (before restarting)
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload nginx without downtime
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

# View nginx access logs
docker-compose -f docker-compose.prod.yml logs nginx | grep "GET /"

# View nginx error logs
docker-compose -f docker-compose.prod.yml logs nginx | grep "error"
```

## Networking

### Development Network

- **Network name**: `radio-network-dev`
- **Driver**: Bridge
- **Services**: Single container (radio-calico-dev)

### Production Network

- **Network name**: `radio-network`
- **Driver**: Bridge
- **Services**: Three containers connected internally
  - `postgres` (5432) - PostgreSQL database
  - `radio-calico-api` (3000) - Node.js API backend
  - `nginx` (80) - Web server and reverse proxy

**Internal communication:**
- Nginx → API: `http://radio-calico-api:3000`
- API → PostgreSQL: `postgres:5432`

**External access:**
- Only nginx port 80 is exposed to host
- API and PostgreSQL are isolated from external access

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs radio-calico-dev

# Common issues:
# - Port 3000 already in use: Change port in docker-compose.yml
# - Database locked: Stop other instances accessing radio.db
# - Permission errors: Ensure Docker has access to project directory
```

### Build errors

```bash
# Clear Docker cache and rebuild
docker-compose build --no-cache

# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up --build
```

### Database issues

**Development (SQLite):**
```bash
# Reset development database
rm radio.db
docker-compose restart
```

**Production (PostgreSQL):**
```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Check if PostgreSQL is ready
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U radio

# Connect to PostgreSQL to debug
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio

# Reset production database (DANGER: deletes all data)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

### Health check failing

**Development:**
```bash
# Check if API is responding
docker-compose exec radio-calico-dev wget -O- http://localhost:3000/api/health

# Check server logs
docker-compose logs radio-calico-dev

# Restart container
docker-compose restart radio-calico-dev
```

**Production:**
```bash
# Check which service is unhealthy
docker ps

# Check nginx health
docker-compose -f docker-compose.prod.yml exec nginx wget -O- http://localhost/health

# Check API health (internal)
docker-compose -f docker-compose.prod.yml exec radio-calico-api wget -O- http://localhost:3000/api/health

# Check PostgreSQL health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U radio

# View logs for unhealthy service
docker-compose -f docker-compose.prod.yml logs nginx
docker-compose -f docker-compose.prod.yml logs radio-calico-api
docker-compose -f docker-compose.prod.yml logs postgres

# Restart specific service
docker-compose -f docker-compose.prod.yml restart nginx
docker-compose -f docker-compose.prod.yml restart radio-calico-api
docker-compose -f docker-compose.prod.yml restart postgres
```

### Windows-specific issues

```bash
# Line ending issues - convert to LF (not CRLF)
# In Git Bash or WSL:
dos2unix server.js

# Path mounting issues - use absolute Windows paths
# In PowerShell:
docker run -v ${PWD}:/app ...
```

## Production Deployment Examples

### Deploy to Remote Server (Full Stack)

Production requires all three services: PostgreSQL, API, and Nginx.

```bash
# 1. On local machine, prepare files
# Ensure you have: docker-compose.prod.yml, nginx.conf, .env

# 2. Create .env file with secure password
cat > .env << EOF
NODE_ENV=production
PORT=80
DATABASE_TYPE=postgres
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=radio
POSTGRES_USER=radio
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EOF

# 3. Copy files to server
scp docker-compose.prod.yml user@server:~/radio-calico/
scp nginx.conf user@server:~/radio-calico/
scp .env user@server:~/radio-calico/
scp -r public user@server:~/radio-calico/

# 4. SSH to server and deploy
ssh user@server
cd ~/radio-calico
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify deployment
docker ps  # Should show 3 healthy containers
curl http://localhost/api/health
```

### Deploy with Docker Registry

For larger deployments, use a Docker registry:

```bash
# 1. Tag and push images to registry
docker tag radio-calico-api myregistry.com/radio-calico-api:latest
docker push myregistry.com/radio-calico-api:latest

# 2. On server, update docker-compose.prod.yml to use registry image
services:
  radio-calico-api:
    image: myregistry.com/radio-calico-api:latest
    # Remove build section

# 3. Pull and deploy
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Deploy with HTTPS (Let's Encrypt)

To add HTTPS support, modify `nginx.conf` to include SSL configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ... rest of nginx config ...
}
```

Then mount SSL certificates:

```yaml
# docker-compose.prod.yml
services:
  nginx:
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./public:/usr/share/nginx/html:ro
      - ./ssl:/etc/nginx/ssl:ro  # Add SSL certificates
    ports:
      - "80:80"
      - "443:443"  # Add HTTPS port
```


## Maintenance Commands

### Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a

# Remove specific image
docker rmi radio-calico:dev
```

### Updates

```bash
# Pull latest base image
docker pull node:22-alpine

# Rebuild with latest dependencies
docker-compose build --no-cache --pull

# Restart with new image
docker-compose up -d
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# View logs for specific service
docker-compose logs radio-calico-dev
```

## Security Best Practices

### Production Security

- ✅ Runs as non-root user (`nodejs:nodejs`)
- ✅ Multi-stage build (no build tools in final image)
- ✅ Production dependencies only
- ✅ Health checks enabled
- ✅ Restart policy configured
- ✅ Network isolation via Docker networks

### Additional Hardening

1. **Use secrets for sensitive data**:
   ```yaml
   secrets:
     db_password:
       file: ./db_password.txt
   ```

2. **Limit container resources**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 512M
   ```

3. **Enable read-only root filesystem**:
   ```yaml
   read_only: true
   tmpfs:
     - /tmp
     - /app/data
   ```

4. **Use HTTPS with reverse proxy** (nginx/Caddy)

5. **Regular security updates**:
   ```bash
   docker-compose build --pull
   docker-compose up -d
   ```

## Performance Optimization

### Image Size Comparison

- **Development**: ~350MB (includes devDependencies, build tools)
- **Production**: ~150MB (multi-stage build, production only)

### Reducing Build Time

```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build

# Cache dependencies between builds (automatic with docker-compose)
docker-compose build
```

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'      # Limit to 50% of one CPU
      memory: 256M     # Limit to 256MB RAM
    reservations:
      cpus: '0.25'     # Reserve 25% of one CPU
      memory: 128M     # Reserve 128MB RAM
```

## Monitoring

### Container Stats

```bash
# Real-time stats
docker stats radio-calico-prod

# One-time stats
docker stats --no-stream
```

### Application Logs

```bash
# Follow logs
docker-compose logs -f

# Export logs to file
docker-compose logs > logs.txt
```

### Health Status

```bash
# Check health
curl http://localhost:3000/api/health

# Response:
# {
#   "status": "ok",
#   "database": "connected",
#   "timestamp": "2025-11-29T12:00:00.000Z"
# }
```

## Support

For issues or questions:

1. Check this guide first
2. Review Docker logs: `docker-compose logs`
3. Check GitHub issues: https://github.com/yourusername/radio-calico/issues
4. Consult Docker documentation: https://docs.docker.com

## Version History

- **v1.0** - Initial Docker configuration (development only)
- **v2.0** - Added production builds, multi-stage optimization, health checks
