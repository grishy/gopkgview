.PHONY: help deps build-frontend build-go demo dev clean

help:
	@echo "gopkgview - Go dependency visualization tool"
	@echo ""
	@echo "Common commands:"
	@echo "  make deps          - Install frontend and backend dependencies"
	@echo "  make build-frontend - Build frontend (production mode)"
	@echo "  make build-go      - Compile Go binary"
	@echo "  make demo          - Run demo: analyze this project and start frontend"
	@echo "  make dev           - Local development: start Go + frontend hot reload"
	@echo "  make dev-remote    - Remote development: start Go + frontend (allow remote access)"
	@echo "  make clean         - Clean build files"

# Install dependencies
deps: deps-go deps-frontend

deps-go:
	@echo ">>> Installing Go dependencies..."
	go mod download
	go mod tidy

deps-frontend:
	@echo ">>> Installing frontend dependencies..."
	cd frontend && npm install

# Build frontend
build-frontend: deps-frontend
	@echo ">>> Building frontend..."
	cd frontend && npm run build

# Compile Go binary
build-go: deps-go build-frontend
	@echo ">>> Compiling Go binary..."
	go build -o gopkgview

# Demo mode: analyze this project and start frontend
demo: build-go
	@echo ">>> Starting demo..."
	@echo "Will analyze gopkgview project's dependencies"
	@echo "Frontend will automatically open in browser"
	@echo ""
	./gopkgview --root=. --gomod=./go.mod

# Development mode: start Go server + frontend hot reload (local)
dev: deps build-frontend
	@echo ">>> Starting local development mode..."
	@echo "Frontend development server: http://localhost:5173"
	@echo "Backend data API: http://localhost:8080/data"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@echo ""
	# Start Go service in background (analyze current project)
	go run main.go --root=. --gomod=./go.mod --skip-browser --addr=:8080 &
	@sleep 1
	# Start frontend development server
	cd frontend && npm run dev

# Remote development mode: start Go server + frontend hot reload (allow remote access)
dev-remote: deps build-frontend
	@echo ">>> Starting remote development mode..."
	@echo ""
	@echo "⚠️  Important information:"
	@echo "Frontend: http://<remote-ip>:5173"
	@echo "Backend: http://<remote-ip>:8080"
	@echo ""
	@echo "When connecting from local, replace <remote-ip> with actual IP address"
	@echo "Example: http://192.168.1.100:5173"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@echo ""
	# Start Go service in background (listen on all interfaces)
	go run main.go --root=. --gomod=./go.mod --skip-browser --addr=:8080 &
	@sleep 1
	# Start frontend development server (already configured with host: 0.0.0.0 in vite.config.js)
	cd frontend && npm run dev

# Clean build files
clean:
	@echo ">>> Cleaning build files..."
	rm -f gopkgview
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	go clean

.PHONY: help deps deps-go deps-frontend build-frontend build-go demo dev dev-remote clean
