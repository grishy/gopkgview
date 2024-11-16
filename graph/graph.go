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
	PkgTypeLocal  PkgTypeEnum = "loc"
	PkgTypeErr    PkgTypeEnum = "err"
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

	// We build graph during graph creation, so we don't need to lock these later.
	nodes []Node
	edges []Edge
}

// New creates a new graph of dependencies starting from the root directory.
// maxGoroutines is the maximum number of goroutines to use for parsing in parallel.
func New(root string, maxGoroutines uint) (*Graph, error) {
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

	graph.buildCtx.Dir = absRoot

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
		log.Printf("failed to import %s: %v", path, err)

		g.addNode(path, "[err] "+path, PkgTypeErr)
		return
	}

	pkgType := PkgTypeLocal
	if pkg.Goroot {
		pkgType = PkgTypeStdLib
	} else if g.gomodIdx.HasPrefix(pkg.ImportPath) {
		pkgType = PkgTypeExtLib
	}

	g.addNode(pkg.ImportPath, pkg.Name, pkgType)
	for _, imp := range pkg.Imports {
		// We don't want to recurse into std lib or external packages
		if pkgType != PkgTypeLocal {
			continue
		}

		g.addEdge(pkg.ImportPath, imp)

		g.parseWg.Add(1)
		go g.recurseImport(imp, pkg.Dir)
	}
}

func (g *Graph) addNode(path, name string, pkgType PkgTypeEnum) {
	g.parseMx.Lock()
	defer g.parseMx.Unlock()
	g.nodes = append(g.nodes, Node{
		ImportPath: path,
		Name:       name,
		PkgType:    pkgType,
	})
}

func (g *Graph) addEdge(from, to string) {
	g.parseMx.Lock()
	defer g.parseMx.Unlock()
	g.edges = append(g.edges, Edge{
		From: from,
		To:   to,
	})
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

	trieIndex := trie.New()
	for _, require := range gomod.Require {
		trieIndex.Put(require.Mod.Path)
	}

	return trieIndex, nil
}
