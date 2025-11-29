# Docker Deployment Guide for Radio Calico

This guide explains how to deploy Radio Calico using Docker in both development and production environments.

## Prerequisites

- Docker Desktop for Windows (version 28.1.1 or later)
- Docker Compose (included with Docker Desktop)
- 2GB free disk space for images and volumes

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
# Build and start production server
docker-compose -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop the server
docker-compose -f docker-compose.prod.yml down
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
- **Multi-stage build**: Smaller image size (~150MB vs ~350MB)
- **Security hardened**: Runs as non-root user (nodejs:nodejs)
- **Production dependencies only**: No devDependencies installed
- **Named volumes**: Database persists in Docker-managed volume
- **Health checks**: Automatic health monitoring
- **Restart policy**: Automatically restarts on failure

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

- [ ] Build production image: `docker-compose -f docker-compose.prod.yml build`
- [ ] Test image locally: `docker-compose -f docker-compose.prod.yml up`
- [ ] Verify health check: `docker ps` (should show "healthy")
- [ ] Test API endpoints: `curl http://localhost:3000/api/health`
- [ ] Check logs for errors: `docker-compose -f docker-compose.prod.yml logs`
- [ ] Configure firewall rules (if deploying to server)
- [ ] Set up reverse proxy (nginx/Caddy) for HTTPS
- [ ] Configure backup strategy for database volume

## Database Management

### Development Database

The SQLite database file (`radio.db`) is stored in your project directory:

```bash
# Location: ./radio.db
# Automatically created on first run
# Persists between container restarts
# Can be backed up/copied like any file
```

### Production Database

The production database is stored in a Docker named volume:

```bash
# View volumes
docker volume ls

# Inspect the database volume
docker volume inspect radio_radio-data

# Backup the database
docker run --rm -v radio_radio-data:/data -v ${PWD}:/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore the database
docker run --rm -v radio_radio-data:/data -v ${PWD}:/backup alpine tar xzf /backup/db-backup.tar.gz -C /data
```

### Database Location

The database path is configurable via the `DB_PATH` environment variable:

- **Development**: `./radio.db` (default)
- **Production**: `/app/data/radio.db` (in Docker volume)

To use a custom path:

```yaml
environment:
  - DB_PATH=/custom/path/radio.db
```

## Environment Variables

### Available Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Node environment (`development` or `production`) |
| `PORT` | `3000` | Server port |
| `DB_PATH` | `radio.db` | SQLite database file path |

### Setting Environment Variables

#### Docker Compose

Edit `docker-compose.yml` or `docker-compose.prod.yml`:

```yaml
environment:
  - PORT=8080
  - DB_PATH=/app/data/custom.db
```

#### Standalone Docker

```bash
docker run -e PORT=8080 -e DB_PATH=/app/data/custom.db radio-calico:prod
```

## Port Configuration

The default port is **3000**. To change it:

### Development

Edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Host:Container
environment:
  - PORT=3000    # Container internal port
```

### Production

Edit `docker-compose.prod.yml`:

```yaml
ports:
  - "80:3000"    # Expose on port 80
environment:
  - PORT=3000
```

## Health Checks

Both development and production images include health checks that ping the `/api/health` endpoint every 30 seconds.

### Checking Health Status

```bash
# View health status
docker ps

# Inspect health check details
docker inspect radio-calico-prod | grep -A 10 Health
```

### Health Check Configuration

The health check tests if the API is responding:

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start period**: 40 seconds (grace period during startup)

## Networking

### Development Network

- **Network name**: `radio-network-dev`
- **Driver**: Bridge
- **Isolation**: Development container is isolated

### Production Network

- **Network name**: `radio-network`
- **Driver**: Bridge
- **Isolation**: Production container is isolated

### Connecting External Services

To connect other containers (e.g., nginx reverse proxy):

```yaml
services:
  nginx:
    image: nginx:alpine
    networks:
      - radio-network
    depends_on:
      - radio-calico
```

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

```bash
# Reset development database
rm radio.db
docker-compose restart

# Reset production database volume
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

### Health check failing

```bash
# Check if API is responding
docker-compose exec radio-calico-prod wget -O- http://localhost:3000/api/health

# Check server logs
docker-compose logs radio-calico-prod

# Restart container
docker-compose restart radio-calico-prod
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

### Deploy to Remote Server

```bash
# 1. Build image on local machine
docker build -f Dockerfile.prod -t radio-calico:latest .

# 2. Save image to tar file
docker save radio-calico:latest > radio-calico.tar

# 3. Copy to server
scp radio-calico.tar user@server:/tmp/

# 4. On the server, load and run
ssh user@server
docker load < /tmp/radio-calico.tar
docker run -d -p 3000:3000 -v radio-data:/app/data --name radio-calico radio-calico:latest
```

### Deploy with Nginx Reverse Proxy

```yaml
version: '3.8'

services:
  radio-calico:
    build:
      context: .
      dockerfile: Dockerfile.prod
    networks:
      - radio-network
    volumes:
      - radio-data:/app/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - radio-network
    depends_on:
      - radio-calico

volumes:
  radio-data:

networks:
  radio-network:
```

### Deploy to Docker Registry

```bash
# Tag for registry
docker tag radio-calico:prod myregistry.com/radio-calico:latest

# Push to registry
docker push myregistry.com/radio-calico:latest

# Pull and run on any server
docker pull myregistry.com/radio-calico:latest
docker run -d -p 3000:3000 myregistry.com/radio-calico:latest
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
