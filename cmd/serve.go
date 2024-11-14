package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"go/build"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/urfave/cli/v2"
	"golang.org/x/mod/modfile"
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

			modContent, err := os.ReadFile(filepath.Join(root, "go.mod"))
			if err != nil {
				return fmt.Errorf("failed to read go.mod: %w", err)
			}

			file, err := modfile.Parse("go.mod", modContent, nil)
			if err != nil {
				return fmt.Errorf("failed to parse go.mod: %w", err)
			}

			allRequires := make(map[string]string, len(file.Require))
			for _, require := range file.Require {
				allRequires[require.Mod.Path] = require.Mod.Version
			}

			pkgPrefix := file.Module.Mod.Path
			// spew.Dump(allRequires)

			ctx := &build.Default
			ctx.CgoEnabled = false

			// Build tree of dependencies
			slog.Info("Package prefix", slog.String("root", root), slog.String("pkgPrefix", pkgPrefix))

			pkgName := "."
			tree := recurseDeps(ctx, allRequires, root, pkgName)

			spew.Dump(tree)

			// Convert tree to  { source: "Microsoft", target: "Amazon", type: "licensing" },

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

			type link struct {
				ID     string `json:"id"`
				Source string `json:"source"`
				Target string `json:"target"`
				Type   string `json:"type"`
			}

			type output struct {
				Nodes []node `json:"nodes"`
				Links []link `json:"links"`
			}

			out := output{
				Links: []link{},
			}

			nodesList := make(map[string]int)
			var recurse func(n *Node)
			recurse = func(n *Node) {
				nodesList[n.ID] = 2

				for _, child := range n.Children {
					nodesList[child.ID] = 2

					out.Links = append(out.Links, link{
						ID:     fmt.Sprintf("%s-%s", n.ID, child.ID),
						Source: n.ID,
						Target: child.ID,
						Type:   "smoothstep",
					})

					recurse(child)
				}
			}
			recurse(tree)

			nodesList[tree.ID] = 1
			for n := range nodesList {
				if strings.HasPrefix(n, pkgPrefix) {
					nodesList[n] = 1
				}
			}

			for n := range nodesList {
				out.Nodes = append(out.Nodes, node{
					ID: n,
					Data: nodeData{
						Label: n,
					},
					Position: position{
						X: 0,
						Y: 0,
					},
				})
			}

			dataNode, err := json.Marshal(out.Nodes)
			if err != nil {
				return fmt.Errorf("failed to marshal tree: %w", err)
			}

			if err := os.WriteFile("nodes.json", dataNode, 0o644); err != nil {
				return fmt.Errorf("failed to write node_list.json: %w", err)
			}

			dataLinks, err := json.Marshal(out.Links)
			if err != nil {
				return fmt.Errorf("failed to marshal tree: %w", err)
			}

			if err := os.WriteFile("links.json", dataLinks, 0o644); err != nil {
				return fmt.Errorf("failed to write node_list.json: %w", err)
			}

			treeJSON, err := json.Marshal(tree)
			if err != nil {
				return fmt.Errorf("failed to marshal tree: %w", err)
			}

			if err := os.WriteFile("tree.json", treeJSON, 0o644); err != nil {
				return fmt.Errorf("failed to write tree.json: %w", err)
			}

			return nil
		},
	}
}

type Node struct {
	ID       string
	Name     string
	Children []*Node
}

// TODO: Implement concurrency and cache
func recurseDeps(ctx *build.Context, allRequires map[string]string, dir, pkgName string) *Node {
	fmt.Println("recurseDeps", dir, pkgName)

	pkg, err := ctx.Import(pkgName, dir, 0)
	if err != nil {
		panic(err)
	}

	if pkg.Goroot {
		// TODO: Configure if packages in std lib shall be visited
		return nil
	}

	node := &Node{
		ID:   pkg.ImportPath,
		Name: pkg.Name,
	}

	// Skip reqierements that are not in the go.mod
	for key := range allRequires {
		if strings.HasPrefix(pkg.ImportPath, key) {
			// return nil
			return node
		}
	}

	children := make([]*Node, 0, len(pkg.Imports))
	for _, imp := range pkg.Imports {
		node := recurseDeps(ctx, allRequires, pkg.Dir, imp)
		if node != nil {
			children = append(children, node)
		}
	}

	node.Children = children

	return node
}
