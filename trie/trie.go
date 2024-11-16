// Package trie provides a prefix tree optimized for Go import paths,
// offering O(m) operations where m is the path length. Specialized
// for module path lookups in go.mod files.
package trie

import (
	"sort"
	"strings"
)

type PathTrie struct {
	children map[string]*PathTrie
}

// New creates a new Trie.
func New() *PathTrie {
	// We initialize the trie with a root node to avoid returning true for empty trie.
	return &PathTrie{
		children: make(map[string]*PathTrie),
	}
}

// Put inserts a path into the trie structure.
func (t *PathTrie) Put(importPath string) {
	curr := t
	for seg, nextIdx := segmenter(importPath, 0); seg != ""; seg, nextIdx = segmenter(importPath, nextIdx) {
		child := curr.children[seg]
		if child == nil {
			if curr.children == nil {
				curr.children = make(map[string]*PathTrie)
			}
			child = &PathTrie{}
			curr.children[seg] = child
		}
		curr = child
	}
}

// HasPrefix checks if a path with the given prefix exists or could potentially exist in the trie.
// If trie is 'a/b/c':
// - 'a/b'     - true.
// - 'a/b/c/d' - true, because we may have 'd' in trie, no collision.
// - 'a/b/f'   - false, we hit a point where missing child node.
// We need this because if we have in go.mod 'github.com/a/b', we can import 'github.com/a/b/baz' in out code.
// '/baz' is not in go.mod, part of external package.
func (t *PathTrie) HasPrefix(prefix string) bool {
	node := t
	for seg, idx := segmenter(prefix, 0); seg != ""; seg, idx = segmenter(prefix, idx) {
		if node.children == nil {
			return true
		}
		child := node.children[seg]
		if child == nil {
			return false
		}
		node = child
	}
	return true
}

// Count returns the total number of nodes.
func (t *PathTrie) Count() int {
	total := 1
	for _, child := range t.children {
		total += child.Count()
	}
	return total
}

// String returns a human-readable representation of the trie.
func (t *PathTrie) String() string {
	var sb strings.Builder
	drawNode(&sb, t, "", true, "(root)")
	return sb.String()
}

func drawNode(sb *strings.Builder, node *PathTrie, prefix string, isLast bool, path string) {
	sb.WriteString(prefix)
	if isLast {
		sb.WriteString("└── ")
	} else {
		sb.WriteString("├── ")
	}
	sb.WriteString(path + "\n")

	keys := make([]string, 0, len(node.children))
	for k := range node.children {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for i, k := range keys {
		childIsLast := i == len(keys)-1
		newPrefix := prefix
		if isLast {
			newPrefix += "    "
		} else {
			newPrefix += "│   "
		}
		drawNode(sb, node.children[k], newPrefix, childIsLast, k)
	}
}

// segmenter segments string key paths by slash separators. For example,
// "/a/b/c" -> ("/a", 2), ("/b", 4), ("/c", -1) in successive calls. It does
// not allocate any heap memory.
func segmenter(path string, start int) (string, int) {
	if start >= len(path) || start < 0 {
		return "", -1
	}

	end := strings.IndexRune(path[start+1:], '/') // next '/' after 0th rune
	if end == -1 {
		return path[start:], -1
	}
	return path[start : start+end+1], start + end + 1
}
