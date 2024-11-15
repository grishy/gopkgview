package graph

import (
	"fmt"
	"go/build"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/grishy/gopkgview/trie"
	"golang.org/x/mod/modfile"
)

type PkgTypeEnum string

const (
	PkgTypeStdLib PkgTypeEnum = "std"
	PkgTypeExtLib PkgTypeEnum = "ext"
	PkgTypeLocal  PkgTypeEnum = "local"
)

type Node struct {
	ImportPath string
	Name       string
	PkgType    PkgTypeEnum
}

type Edge struct {
	From string
	To   string
}

type Graph struct {
	buildCtx *build.Context
	absRoot  string
	gomodIdx *trie.PathTrie

	parseMx    sync.Mutex          // TODO: Use later for concurrency
	parseCache map[string]struct{} // Visited packages

	nodes []Node
	edges []Edge
}

func New(root string) (*Graph, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	gomodIdx, err := parseGoMod(absRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	graph := &Graph{
		buildCtx:   &build.Default,
		parseCache: make(map[string]struct{}),
		absRoot:    absRoot,
		gomodIdx:   gomodIdx,
	}

	graph.buildCtx.CgoEnabled = false // TODO: Check if this is needed

	graph.recurseImport(".", absRoot)

	return graph, nil
}

func (g *Graph) Nodes() []Node {
	return g.nodes
}

func (g *Graph) Edges() []Edge {
	return g.edges
}

// TODO: Implement cuncurrency with max limit of goroutines
func (g *Graph) recurseImport(path, srcDir string) {
	// Avoid parsing the same package multiple times
	if _, ok := g.parseCache[path]; ok {
		return
	}
	g.parseCache[path] = struct{}{}

	pkg, err := g.buildCtx.Import(path, srcDir, 0)
	if err != nil {
		// TODO: mark package as errored to change view in UI
		log.Printf("failed to import %s: %v", path, err)
		return
	}

	pkgType := PkgTypeLocal
	if pkg.Goroot {
		pkgType = PkgTypeStdLib
	} else if g.gomodIdx.HasPrefix(pkg.ImportPath) {
		pkgType = PkgTypeExtLib
	}

	g.nodes = append(g.nodes, Node{
		ImportPath: pkg.ImportPath,
		Name:       pkg.Name,
		PkgType:    pkgType,
	})

	// We don't want to recurse into std lib or external packages
	for _, imp := range pkg.Imports {
		if pkgType == PkgTypeLocal {
			g.edges = append(g.edges, Edge{
				From: pkg.ImportPath,
				To:   imp,
			})

			g.recurseImport(imp, pkg.Dir)
		}
	}
}

func parseGoMod(root string) (*trie.PathTrie, error) {
	modContent, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return nil, fmt.Errorf("failed to read go.mod: %w", err)
	}

	gomod, err := modfile.Parse("go.mod", modContent, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	trieIndex := trie.NewPathTrie()
	for _, require := range gomod.Require {
		trieIndex.Put(require.Mod.Path)
	}

	return trieIndex, nil
}
