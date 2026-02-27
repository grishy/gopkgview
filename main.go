// Package main provides the CLI entry point for gopkgview, a Go dependency visualization tool.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"time"

	"github.com/pkg/browser"
	"github.com/urfave/cli/v2"

	"github.com/grishy/gopkgview/graph"
)

// Version information, injected at build time via ldflags.
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

//go:embed frontend/dist/*
var frontend embed.FS

// buildVersion returns a formatted version string with build metadata.
func buildVersion() string {
	if version == "dev" {
		return fmt.Sprintf("%s (commit: %s, built: %s)", version, commit, date)
	}
	return fmt.Sprintf("v%s (commit: %s, built: %s)", version, commit, date)
}

func createJSONHandler(defaultDir string, maxGoroutines uint) http.HandlerFunc {

	absDefault, err := filepath.Abs(defaultDir)
	if err != nil {
		log.Printf("could not get absolute path for: %s", defaultDir)
	}

	return func(w http.ResponseWriter, req *http.Request) {

		log.Printf("request: %s", req.RequestURI)

		var data []byte

		if req.URL.Query().Has("file") {

			absPath, err := filepath.Abs(req.URL.Query().Get("file"))
			if err != nil {
				log.Printf("failed to get absolute path: %v", err)
				return
			}

			data, err = createJsonData(absPath, maxGoroutines)
			if err != nil {
				log.Printf("Failed to create JSON data: %v", err)
			}

		} else {

			data, err = createJsonData(absDefault, maxGoroutines)
			if err != nil {
				log.Printf("could not create JSON data for: %s", defaultDir)
			}
		}

		w.Header().Set("Access-Control-Allow-Origin", "*") // Disable CORS for simplicity of UI development
		w.Header().Set("Content-Type", "application/json")
		if _, writeErr := w.Write(data); writeErr != nil {
			log.Printf("Failed to write JSON: %v", writeErr)
		}
	}
}
func setupHTTPServer(root string, maxGoroutines uint) (*http.ServeMux, error) {

	fsys, err := fs.Sub(frontend, "frontend/dist")
	if err != nil {
		return nil, fmt.Errorf("failed to get frontend subdirectory: %w", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/data", createJSONHandler(root, maxGoroutines))
	mux.Handle("/", http.FileServer(http.FS(fsys)))

	return mux, nil
}

func startServer(server *http.Server, listener net.Listener, skipBrowser bool) {

	log.Print("Starting server on ", listener.Addr())

	if !skipBrowser {
		webAddr := "http://" + listener.Addr().String()
		log.Println("Opening browser on ", webAddr)
		if browserErr := browser.OpenURL(webAddr); browserErr != nil {
			log.Printf("Failed to open browser: %v", browserErr)
		}
	}

	if serveErr := server.Serve(listener); serveErr != http.ErrServerClosed {
		log.Fatalf("Serve(): %v", serveErr)
	}
}

func runApp(ctx context.Context, cCtx *cli.Context) error {
	addr := cCtx.String("addr")
	skipBrowser := cCtx.Bool("skip-browser")
	root := cCtx.String("root")
	maxGoroutines := cCtx.Uint("max-goroutines")

	mux, err := setupHTTPServer(root, maxGoroutines)
	if err != nil {
		return err
	}

	// Start on any available port
	lc := &net.ListenConfig{}
	listener, err := lc.Listen(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	defer func() {
		if closeErr := listener.Close(); closeErr != nil {
			log.Printf("Failed to close listener: %v", closeErr)
		}
	}()

	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go startServer(server, listener, skipBrowser)

	<-ctx.Done()
	log.Print("Shutting down...")
	return server.Shutdown(ctx)
}

func createJsonData(absPath string, maxGoroutines uint) ([]byte, error) {

	var dataJSON []byte

	log.Println("Creating graph...")
	packageGraph, err := graph.New(absPath, maxGoroutines)
	if err != nil {
		return dataJSON, fmt.Errorf("failed to build graph: %w", err)
	}
	log.Println("Graph created")

	// Generate JSON blob for the UI
	frontendData := map[string]any{
		"nodes": packageGraph.Nodes(),
		"edges": packageGraph.Edges(),
	}

	dataJSON, err = json.Marshal(frontendData)
	if err != nil {
		return dataJSON, fmt.Errorf("failed to marshal to JSON: %w", err)
	}

	return dataJSON, nil
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer stop()

	// We are not long-running, time is enough
	log.SetFlags(log.Lmicroseconds)

	// Add a handler for force exiting if we don't exit gracefully (stuck)
	go func() {
		<-ctx.Done()
		time.Sleep(3 * time.Second)

		log.Print("Force exit")
		os.Exit(1)
	}()

	app := &cli.App{
		Name:    "gopkgview",
		Usage:   "Show dependencies of a Go package",
		Version: buildVersion(),
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "root",
				EnvVars:     []string{"GO_PKGVIEW_ROOT"},
				Usage:       "Path to start from",
				DefaultText: "./",
			},
			&cli.StringFlag{
				Name:    "gomod",
				EnvVars: []string{"GO_PKGVIEW_GOMOD"},
				Usage:   "Path to go.mod file to detect external dependencies",
			},
			&cli.StringFlag{
				Name:        "addr",
				EnvVars:     []string{"GO_PKGVIEW_ADDR"},
				Usage:       "Address to listen on",
				DefaultText: ":0",
			},
			&cli.UintFlag{
				Name:    "max-goroutines",
				EnvVars: []string{"GO_PKGVIEW_MAX_GOROUTINES"},
				Usage:   "Maximum number of goroutines to use for parsing in parallel",
				Value:   20,
			},
			&cli.BoolFlag{
				Name:    "skip-browser",
				EnvVars: []string{"GO_PKGVIEW_SKIP_BROWSER"},
				Usage:   "Don't open browser on start",
			},
		},
		Action: func(cCtx *cli.Context) error {
			return runApp(ctx, cCtx)
		},
	}

	if err := app.Run(os.Args); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Error: %+v\n", err)
	}
}
