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

	parseMx    sync.Mutex
	parseWg    sync.WaitGroup
	parseSem   chan struct{}
	parseCache map[string]struct{} // Visited packages

	nodes []Node
	edges []Edge
}

func New(root string) (*Graph, error) {
	const maxGoroutines = 20 // TODO: make it configurable

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	gomodIdx, err := parseGoMod(absRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	graph := &Graph{
		buildCtx: &build.Default,
		absRoot:  absRoot,
		gomodIdx: gomodIdx,

		parseMx:    sync.Mutex{},
		parseWg:    sync.WaitGroup{},
		parseSem:   make(chan struct{}, maxGoroutines),
		parseCache: make(map[string]struct{}),

		nodes: []Node{},
		edges: []Edge{},
	}

	graph.buildCtx.CgoEnabled = false // TODO: Check if this is needed

	graph.parseWg.Add(1)
	go graph.recurseImport(".", absRoot)
	graph.parseWg.Wait()

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
	defer g.parseWg.Done()

	// Limit the number of goroutines in flight
	g.parseSem <- struct{}{}
	defer func() { <-g.parseSem }()

	// Avoid parsing the same package multiple times
	g.parseMx.Lock()
	if _, ok := g.parseCache[path]; ok {
		g.parseMx.Unlock()
		return
	}
	g.parseCache[path] = struct{}{}
	g.parseMx.Unlock()

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

	g.parseMx.Lock()
	g.nodes = append(g.nodes, Node{
		ImportPath: pkg.ImportPath,
		Name:       pkg.Name,
		PkgType:    pkgType,
	})
	g.parseMx.Unlock()

	for _, imp := range pkg.Imports {
		// We don't want to recurse into std lib or external packages
		if pkgType != PkgTypeLocal {
			continue
		}

		g.parseMx.Lock()
		g.edges = append(g.edges, Edge{
			From: pkg.ImportPath,
			To:   imp,
		})
		g.parseMx.Unlock()

		g.parseWg.Add(1)
		go g.recurseImport(imp, pkg.Dir)
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
