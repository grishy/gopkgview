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

	log.SetFlags(log.Lmicroseconds) // We don't need the date, time enough

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
			// TODO: add a flag to specify the port
			// TODO: number of goroutines
			&cli.StringFlag{
				Name:        "root",
				EnvVars:     []string{"GO_PKGVIEW_ROOT"},
				Usage:       "From which directory find go.mod",
				DefaultText: "./",
			},
		},
		Action: func(cCtx *cli.Context) error {
			root := cCtx.String("root")

			log.Println("Creating graph...")
			packageGraph, err := graph.New(root, 20)
			if err != nil {
				return fmt.Errorf("failed to build graph: %w", err)
			}
			log.Println("Graph created")

			// Generate JSON blob for the UI
			nodesJSON, err := json.Marshal(packageGraph.Nodes())
			if err != nil {
				return fmt.Errorf("failed to marshal nodes: %w", err)
			}

			edgesJSON, err := json.Marshal(packageGraph.Edges())
			if err != nil {
				return fmt.Errorf("failed to marshal edges: %w", err)
			}

			// Serve the JSON blob
			handler := func(data []byte) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Access-Control-Allow-Origin", "*") // TODO: remove this?
					w.Header().Set("Content-Type", "application/json")
					w.Write(data)
				}
			}

			fsys, err := fs.Sub(frontend, "frontend/dist")
			if err != nil {
				return fmt.Errorf("failed to get frontend subdirectory: %w", err)
			}

			mux := http.NewServeMux()
			mux.Handle("/nodes", handler(nodesJSON))
			mux.Handle("/edges", handler(edgesJSON))
			mux.Handle("/", http.FileServer(http.FS(fsys)))

			// Start on any available port
			listener, err := net.Listen("tcp", ":0")
			if err != nil {
				return fmt.Errorf("failed to listen: %w", err)
			}

			defer listener.Close()

			server := &http.Server{Addr: ":0", Handler: mux}
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
