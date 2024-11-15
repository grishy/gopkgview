package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/carlmjohnson/versioninfo"
	"github.com/grishy/gopkgview/graph"
	"github.com/urfave/cli/v2"
)

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
			packageGraph, err := graph.New(root)
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

			mux := http.NewServeMux()
			mux.Handle("/nodes", handler(nodesJSON))
			mux.Handle("/edges", handler(edgesJSON))
			// TODO: Add a handler for the UI

			server := &http.Server{Addr: ":3000", Handler: mux}
			go func() {
				log.Print("Listening...")
				if err := server.ListenAndServe(); err != http.ErrServerClosed {
					log.Fatalf("ListenAndServe(): %v", err)
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
