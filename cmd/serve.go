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
		Usage: "Announce CNAME records for host via avahi-daemon",
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
			}

			nodeList := make([]node, 0)
			for _, val := range packageGraph.Nodes() {
				nodeList = append(nodeList, node{
					ID: val.ImportPath,
					Data: nodeData{
						Label: val.Name,
					},
					Position: position{
						X: 0,
						Y: 0,
					},
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
					Type:   "bezier",
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
