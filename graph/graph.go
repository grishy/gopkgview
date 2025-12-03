// Package graph provides functionality for building and analyzing Go dependency graphs.
package graph

import (
	"fmt"
	"go/build"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/mod/modfile"

	"github.com/grishy/gopkgview/trie"
)

// PkgTypeEnum represents the type of a Go package (standard library, external, local, or error).
type PkgTypeEnum string

// Package type constants.
const (
	PkgTypeStdLib PkgTypeEnum = "std" // Standard library package
	PkgTypeExtLib PkgTypeEnum = "ext" // External package (from go.mod)
	PkgTypeLocal  PkgTypeEnum = "loc" // Local project package
	PkgTypeErr    PkgTypeEnum = "err" // Package with import errors
)

// Node represents a package node in the dependency graph.
type Node struct {
	ImportPath string
	Name       string
	PkgType    PkgTypeEnum
}

// Edge represents a dependency relationship between two packages.
type Edge struct {
	From string
	To   string
}

// Graph represents a complete dependency graph for a Go project.
type Graph struct {
	buildCtx   *build.Context
	absRoot    string
	modulePath string // Module path from go.mod
	gomodIdx   *trie.PathTrie

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
func New(gomod, root string, maxGoroutines uint) (*Graph, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	modulePath, gomodIdx, err := parseGoMod(gomod)
	if err != nil {
		return nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	graph := &Graph{
		buildCtx:   &build.Default,
		absRoot:    absRoot,
		modulePath: modulePath,
		gomodIdx:   gomodIdx,

		parseMx:    sync.Mutex{},
		parseWg:    sync.WaitGroup{},
		parseSem:   make(chan struct{}, maxGoroutines),
		parseCache: make(map[string]struct{}),

		nodes: []Node{},
		edges: []Edge{},
	}

	graph.buildCtx.Dir = absRoot

	// Discover all directories containing Go files to support monorepos
	// where the root directory may not contain Go files directly
	entryDirs, err := findGoPackageDirs(absRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to discover Go packages: %w", err)
	}

	if len(entryDirs) == 0 {
		return nil, fmt.Errorf("no Go packages found in %s", absRoot)
	}

	// Start recursive import from each discovered package directory
	for _, dir := range entryDirs {
		graph.parseWg.Add(1)
		go graph.recurseImport(".", dir)
	}
	graph.parseWg.Wait()

	return graph, nil
}

// findGoPackageDirs walks the directory tree and returns all directories
// that contain Go source files (excluding test files).
func findGoPackageDirs(root string) ([]string, error) {
	var dirs []string

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			//nolint:nilerr // Intentionally skip inaccessible directories and continue walking
			return nil
		}

		if !d.IsDir() {
			return nil
		}

		name := d.Name()
		// Skip hidden directories, vendor, and testdata
		if strings.HasPrefix(name, ".") || name == "vendor" || name == "testdata" {
			return filepath.SkipDir
		}

		// Check if directory contains Go source files
		if hasGoFiles(path) {
			dirs = append(dirs, path)
		}

		return nil
	})

	return dirs, err
}

// hasGoFiles checks if a directory contains any non-test Go source files.
func hasGoFiles(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".go") && !strings.HasSuffix(name, "_test.go") {
			return true
		}
	}

	return false
}

// Nodes returns all nodes in the dependency graph.
func (g *Graph) Nodes() []Node {
	return g.nodes
}

// Edges returns all edges in the dependency graph.
func (g *Graph) Edges() []Edge {
	return g.edges
}

func (g *Graph) recurseImport(path, srcDir string) {
	defer g.parseWg.Done()

	// Limit the number of goroutines in flight
	g.parseSem <- struct{}{}
	defer func() { <-g.parseSem }()

	pkg, err := g.buildCtx.Import(path, srcDir, 0)
	if err != nil {
		//nolint:sloglint // simple CLI tool, global logger acceptable
		slog.Warn("failed to import package", "path", path, "error", err)

		// Use compound key for error cache to handle "." from different directories
		errKey := path + "@" + srcDir
		g.parseMx.Lock()
		if _, ok := g.parseCache[errKey]; ok {
			g.parseMx.Unlock()
			return
		}
		g.parseCache[errKey] = struct{}{}
		g.addNodeLocked(path, "[err] "+path, PkgTypeErr)
		g.parseMx.Unlock()
		return
	}

	// Compute the proper import path for packages imported as "."
	// by using the module path and relative directory from root
	importPath := pkg.ImportPath
	if importPath == "." {
		relPath, relErr := filepath.Rel(g.absRoot, pkg.Dir)
		if relErr == nil && relPath != "." {
			importPath = g.modulePath + "/" + filepath.ToSlash(relPath)
		} else {
			importPath = g.modulePath
		}
	}

	// Use resolved importPath for cache key
	g.parseMx.Lock()
	if _, ok := g.parseCache[importPath]; ok {
		g.parseMx.Unlock()
		return
	}
	g.parseCache[importPath] = struct{}{}
	g.parseMx.Unlock()

	pkgType := PkgTypeLocal
	if pkg.Goroot {
		pkgType = PkgTypeStdLib
	} else if g.gomodIdx.HasPrefix(importPath) {
		pkgType = PkgTypeExtLib
	}

	g.addNode(importPath, pkg.Name, pkgType)
	for _, imp := range pkg.Imports {
		// We don't want to recurse into std lib or external packages
		if pkgType != PkgTypeLocal {
			continue
		}

		g.addEdge(importPath, imp)

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

// addNodeLocked adds a node without acquiring the mutex (caller must hold the lock).
func (g *Graph) addNodeLocked(path, name string, pkgType PkgTypeEnum) {
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

func parseGoMod(gomod string) (string, *trie.PathTrie, error) {
	modContent, err := os.ReadFile(gomod)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read go.mod: %w", err)
	}

	gomodContent, err := modfile.Parse("in", modContent, nil)
	if err != nil {
		return "", nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	modulePath := gomodContent.Module.Mod.Path

	// TODO: Here is an inaccuracy, because I need to handle also replace directive.
	trieIndex := trie.New()
	for _, require := range gomodContent.Require {
		trieIndex.Put(require.Mod.Path)
	}

	return modulePath, trieIndex, nil
}
