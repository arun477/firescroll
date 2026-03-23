#!/bin/bash

# SSH tunnel to dev server for FireScroll
# Usage: ./tunnel.sh [start|stop|status]

SERVER="dev"
PORTS=(
    "8000:localhost:8000"  # FastAPI backend
    "3000:localhost:3000"  # React frontend
)

PID_FILE="/tmp/firescroll-tunnel.pid"

start_tunnel() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Tunnel already running (PID: $(cat $PID_FILE))"
        return 1
    fi

    PORT_ARGS=""
    for port in "${PORTS[@]}"; do
        PORT_ARGS="$PORT_ARGS -L $port"
    done

    echo "Starting SSH tunnel to $SERVER..."
    echo "Forwarding ports:"
    for port in "${PORTS[@]}"; do
        local_port=$(echo $port | cut -d: -f1)
        echo "  localhost:$local_port -> server:$local_port"
    done

    ssh -N -f $PORT_ARGS $SERVER

    PID=$(pgrep -f "ssh -N -f.*$SERVER" | tail -1)
    if [ -n "$PID" ]; then
        echo $PID > "$PID_FILE"
        echo ""
        echo "Tunnel started (PID: $PID)"
        echo ""
        echo "Access services at:"
        echo "  Backend:  http://localhost:8000"
        echo "  Frontend: http://localhost:3000"
    else
        echo "Failed to start tunnel"
        return 1
    fi
}

stop_tunnel() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "Tunnel stopped (PID: $PID)"
        else
            echo "Tunnel not running"
        fi
        rm -f "$PID_FILE"
    else
        PID=$(pgrep -f "ssh -N.*$SERVER")
        if [ -n "$PID" ]; then
            kill $PID
            echo "Tunnel stopped (PID: $PID)"
        else
            echo "No tunnel running"
        fi
    fi
}

status_tunnel() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Tunnel running (PID: $(cat $PID_FILE))"
        echo ""
        echo "Forwarded ports:"
        for port in "${PORTS[@]}"; do
            local_port=$(echo $port | cut -d: -f1)
            echo "  localhost:$local_port"
        done
    else
        echo "Tunnel not running"
        rm -f "$PID_FILE" 2>/dev/null
    fi
}

case "${1:-start}" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    status)
        status_tunnel
        ;;
    restart)
        stop_tunnel
        sleep 1
        start_tunnel
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac
