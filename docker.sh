#!/bin/bash
# UNS Platform - Docker Management Script
# Usage: ./docker.sh [command]

set -e

case "$1" in
  up|start)
    echo "🚀 Starting UNS Platform..."
    docker compose up -d
    echo "✅ Services started!"
    echo ""
    echo "Access points:"
    echo "  - UNS Platform:  http://localhost:3000"
    echo "  - Grafana:       http://localhost:3001 (admin/admin)"
    echo "  - InfluxDB:      http://localhost:8086 (admin/adminpassword)"
    echo "  - PgAdmin:       http://localhost:5050 (admin@uns-platform.local/admin)"
    ;;
  
  down|stop)
    echo "🛑 Stopping UNS Platform..."
    docker compose down
    echo "✅ Services stopped!"
    ;;
  
  restart)
    echo "🔄 Restarting UNS Platform..."
    docker compose restart
    echo "✅ Services restarted!"
    ;;
  
  logs)
    shift
    docker compose logs -f "$@"
    ;;
  
  ps|status)
    docker compose ps
    ;;
  
  build)
    echo "🔨 Building UNS Platform..."
    docker compose build --no-cache
    echo "✅ Build complete!"
    ;;
  
  rebuild)
    echo "🔨 Rebuilding and restarting..."
    docker compose up -d --build
    echo "✅ Rebuild complete!"
    ;;
  
  reset)
    echo "⚠️  This will DELETE all data!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker compose down -v
      docker compose up -d --build
      echo "✅ Reset complete!"
    fi
    ;;
  
  backup)
    echo "📦 Creating backup..."
    mkdir -p backups
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    docker compose exec -T postgres pg_dump -U uns_user uns_manufacturing > "backups/db_backup_$TIMESTAMP.sql"
    echo "✅ Backup saved to backups/db_backup_$TIMESTAMP.sql"
    ;;
  
  restore)
    shift
    if [ -z "$1" ]; then
      echo "Usage: ./docker.sh restore <backup_file>"
      exit 1
    fi
    echo "📦 Restoring from $1..."
    cat "$1" | docker compose exec -T postgres psql -U uns_user uns_manufacturing
    echo "✅ Restore complete!"
    ;;
  
  shell|sh)
    shift
    SERVICE="${1:-app}"
    docker compose exec "$SERVICE" sh
    ;;
  
  db)
    docker compose exec postgres psql -U uns_user -d uns_manufacturing
    ;;
  
  influx)
    docker compose exec influxdb influx
    ;;
  
  mqtt-sub)
    docker compose exec mqtt mosquitto_sub -h localhost -t "#" -v
    ;;
  
  mqtt-pub)
    shift
    docker compose exec mqtt mosquitto_pub -h localhost -t "$1" -m "$2"
    ;;
  
  *)
    echo "UNS Platform - Docker Management"
    echo ""
    echo "Usage: ./docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up, start      Start all services"
    echo "  down, stop     Stop all services"
    echo "  restart        Restart all services"
    echo "  logs [service] View logs (optional: app, postgres, etc.)"
    echo "  ps, status     Show service status"
    echo "  build          Build images (no cache)"
    echo "  rebuild        Rebuild and restart"
    echo "  reset          Reset everything (WARNING: deletes data)"
    echo "  backup         Create database backup"
    echo "  restore <file> Restore database from backup"
    echo "  shell [svc]    Open shell in container (default: app)"
    echo "  db             Open PostgreSQL CLI"
    echo "  influx         Open InfluxDB CLI"
    echo "  mqtt-sub       Subscribe to all MQTT topics"
    echo "  mqtt-pub       Publish MQTT message (args: topic message)"
    ;;
esac
