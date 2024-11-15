package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/grishy/gopkgview/graph"
	"github.com/urfave/cli/v2"
)

func ServeCmd(ctx context.Context) *cli.Command {
	return &cli.Command{
		Name:  "serve",
		Usage: "Serve the web UI",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "root",
				EnvVars:     []string{"GO_PKGVIEW_ROOT"},
				Usage:       "From which directory find go.mod",
				DefaultText: "./",
			},
		},
		Action: func(cCtx *cli.Context) error {
			root := cCtx.String("root")

			packageGraph, err := graph.New(root)
			if err != nil {
				return fmt.Errorf("failed to build graph: %w", err)
			}

			// Generate files for the UI
			type position struct {
				X int `json:"x"`
				Y int `json:"y"`
			}
			type nodeData struct {
				Label string `json:"label"`
			}
			type node struct {
				ID       string   `json:"id"`
				Position position `json:"position"`
				Data     nodeData `json:"data"`
				PkgType  string   `json:"pkgType"`
			}

			nodeList := make([]node, 0)
			for _, val := range packageGraph.Nodes() {
				nodeList = append(nodeList, node{
					ID: val.ImportPath,
					Data: nodeData{
						Label: func() string {
							switch val.PkgType {
							case graph.PkgTypeStdLib, graph.PkgTypeExtLib:
								return val.ImportPath
							case graph.PkgTypeLocal:
								return val.Name
							default:
								panic(fmt.Sprintf("unknown package type: %s", val.PkgType))
							}
						}(),
					},
					Position: position{
						X: 0,
						Y: 0,
					},
					PkgType: string(val.PkgType),
				})
			}

			dataNode, err := json.Marshal(nodeList)
			if err != nil {
				return fmt.Errorf("failed to marshal tree: %w", err)
			}

			if err := os.WriteFile("./ui/public/nodes.json", dataNode, 0o644); err != nil {
				return fmt.Errorf("failed to write node_list.json: %w", err)
			}

			type edge struct {
				ID     string `json:"id"`
				Source string `json:"source"`
				Target string `json:"target"`
				Type   string `json:"type"`
			}

			edgeList := make([]edge, 0)
			for _, val := range packageGraph.Edges() {
				edgeList = append(edgeList, edge{
					ID:     fmt.Sprintf("%s-%s", val.From, val.To),
					Source: val.From,
					Target: val.To,
					Type:   "default",
				})
			}

			dataEdges, err := json.Marshal(edgeList)
			if err != nil {
				return fmt.Errorf("failed to marshal tree: %w", err)
			}

			if err := os.WriteFile("./ui/public/edges.json", dataEdges, 0o644); err != nil {
				return fmt.Errorf("failed to write edges.json: %w", err)
			}

			return nil
		},
	}
}
