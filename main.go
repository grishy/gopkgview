package main

import (
	"context"
	"embed"
	_ "embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"time"

	"github.com/carlmjohnson/versioninfo"
	"github.com/grishy/gopkgview/graph"
	"github.com/urfave/cli/v2"
)

//go:embed frontend/dist/*
var frontend embed.FS

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
		Version: versioninfo.Short(),
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "root",
				EnvVars:     []string{"GO_PKGVIEW_ROOT"},
				Usage:       "From which directory find go.mod",
				DefaultText: "./",
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
		},
		Action: func(cCtx *cli.Context) error {
			addr := cCtx.String("addr")
			root := cCtx.String("root")
			maxGoroutines := cCtx.Uint("max-goroutines")

			log.Println("Creating graph...")
			packageGraph, err := graph.New(root, maxGoroutines)
			if err != nil {
				return fmt.Errorf("failed to build graph: %w", err)
			}
			log.Println("Graph created")

			// Generate JSON blob for the UI
			frontendData := map[string]interface{}{
				"nodes": packageGraph.Nodes(),
				"edges": packageGraph.Edges(),
			}

			dataJSON, err := json.Marshal(frontendData)
			if err != nil {
				return fmt.Errorf("failed to marshal to JSON: %w", err)
			}

			// Serve the JSON blob
			handler := func(data []byte) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Access-Control-Allow-Origin", "*") // Disable CORS for simplicity of UI development
					w.Header().Set("Content-Type", "application/json")
					w.Write(data)
				}
			}

			fsys, err := fs.Sub(frontend, "frontend/dist")
			if err != nil {
				return fmt.Errorf("failed to get frontend subdirectory: %w", err)
			}

			mux := http.NewServeMux()
			mux.Handle("/data", handler(dataJSON))
			mux.Handle("/", http.FileServer(http.FS(fsys)))

			// Start on any available port
			listener, err := net.Listen("tcp", addr)
			if err != nil {
				return fmt.Errorf("failed to listen: %w", err)
			}

			defer listener.Close()

			server := &http.Server{Handler: mux}
			go func() {
				log.Print("Starting server on ", listener.Addr())
				if err := openbrowser("http://" + listener.Addr().String()); err != nil {
					log.Printf("Failed to open browser: %v", err)
				}

				if err := server.Serve(listener); err != http.ErrServerClosed {
					log.Fatalf("Serve(): %v", err)
				}
			}()

			<-ctx.Done()
			log.Print("Shutting down...")
			return server.Shutdown(ctx)
		},
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Println("Error:")
		fmt.Printf(" > %+v\n", err)
	}
}

// openbrowser took from github.com/becheran/depgraph as it is
// Thanks to becheran
func openbrowser(url string) (err error) {
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	return
}
