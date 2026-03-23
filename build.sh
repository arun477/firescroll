#!/bin/bash

set -e

echo "Building and starting firescroll..."
docker compose up -d --build

echo ""
echo "Waiting for services..."
sleep 5

echo ""
docker compose ps

echo ""
echo "Done!"

