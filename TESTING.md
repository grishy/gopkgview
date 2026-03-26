# Testing Guide - gopkgview

## Quick Start

### Method 1️⃣: One-Click Demo (Recommended)
```bash
make demo
```
This will:
1. ✅ Install all dependencies (Go + Node)
2. ✅ Build frontend
3. ✅ Compile Go program
4. ✅ **Analyze gopkgview project's own dependencies**
5. ✅ Automatically open frontend in browser, showing dependency graph

> In other words: use gopkgview to analyze gopkgview itself!

---

## Detailed Command Reference

| Command | Purpose |
|---------|---------|
| `make deps` | Install dependencies only (Go packages + npm dependencies) |
| `make build-frontend` | Build frontend only |
| `make build-go` | Compile Go program only |
| `make demo` | ⭐ **One-click demo**: Analyze this project + start frontend |
| `make dev` | 🔧 Local development mode: start Go + frontend hot reload |
| `make dev-remote` | 🌐 Remote development mode: start Go + frontend (allow remote access) |
| `make clean` | Clean all build artifacts |

---

## Usage Scenarios

### Scenario 1: Quick Verification (First Time)
```bash
make demo
```
→ Browser automatically opens, showing dependency visualization

---

### Scenario 2: Development Mode (Code Modification)

#### Local Development
```bash
make dev
```
→ Starts:
- Backend Go service (port **8080**, analyzes this project)
- Frontend development server (port **5173**, hot reload)

Visit: `http://localhost:5173`

Code changes auto-refresh ✨

---

#### 🌐 Remote Development (SSH/VS Code Remote/WSL, etc.)
```bash
make dev-remote
```
→ Starts:
- Backend Go service (port **8080**, listening on all interfaces `0.0.0.0`)
- Frontend development server (port **5173**, listening on all interfaces `0.0.0.0`)

**Access from local browser**: Replace `<remote-ip>` with actual IP address
```
http://<remote-ip>:5173
```

Example: `http://192.168.1.100:5173`

---

### FAQ: Two Ports in Remote Development

| Port | Purpose | Description |
|------|---------|-------------|
| **8080** | Backend Go service | Data processing, dependency analysis, API `/data` |
| **5173** | Frontend Vite service | Static resources, hot reload, proxy to `/data` |

**How does frontend get data?**
1. Frontend sends request `GET /data`
2. Vite proxy forwards to `http://localhost:8080/data`
3. Go returns JSON (nodes + edges)
4. Frontend renders into visualization chart

---

### Scenario 3: Analyze Other Projects
```bash
# Compile first
make build-go

# Then analyze any Go project (assuming in ~/my-project)
./gopkgview --root=~/my-project --gomod=~/my-project/go.mod
```

---

## Data Flow

```
make demo
   ↓
[Analyze go.mod] → [Generate dependency graph JSON]
   ↓
[HTTP server] ← [Frontend React]
   ↓
Browser displays visualization chart
```

**Data sources**:
- `go.mod` - Go project dependency list
- Go source code - Local import relationships

**How frontend fetches data**:
- `GET /data` → Get JSON (nodes + edges)
- `GET /` → Get frontend static resources

---

## 🔧 Advanced Usage

### Custom Backend Address (Backend and Frontend Separation)

If backend and frontend run on different machines or ports, set environment variable:

```bash
# Specify backend address (e.g., backend on another machine's 9000 port)
cd frontend
VITE_BACKEND_URL=http://192.168.1.50:9000 npm run dev
```

Or configure in `.env` file:
```
VITE_BACKEND_URL=http://backend-server:8080
```

---

## Frequently Asked Questions

**Q: Error when running demo?**  
A: Check Node/Go versions
```bash
node --version   # Need v16+
go version       # Need 1.25+
```

**Q: Want to see dependencies of different projects?**  
A: 
```bash
./gopkgview --root=/path/to/project --gomod=/path/to/project/go.mod
```

**Q: Backend connection fails during frontend development?**  
A: Make sure:
- Backend is running: `go run main.go --skip-browser`
- Check CORS: All origins already allowed in code

---

🎉 Try `make demo` now!
