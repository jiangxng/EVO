#!/usr/bin/env sh
set -eu
docker compose up -d --build
echo ""
echo "EVO is starting."
echo "Open: http://localhost:3000"
docker compose ps
