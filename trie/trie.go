package trie

import (
	"strings"
)

// PathTrie is a trie data structure for storing Go import paths.
// Allowing for fast prefix searches and checking if a given path exists.
type PathTrie struct {
	children map[string]*PathTrie
}

// NewPathTrie creates a new PathTrie.
func NewPathTrie() *PathTrie {
	return &PathTrie{}
}

func (t *PathTrie) Put(path string) {
	node := t
	for part, i := segmenter(path, 0); part != ""; part, i = segmenter(path, i) {
		child := node.children[part]
		if child == nil {
			if node.children == nil {
				node.children = map[string]*PathTrie{}
			}
			child = &PathTrie{}
			node.children[part] = child
		}

		node = child
	}
}

// HasPrefix checks if a path with the given prefix exists or could potentially exist in the trie.
// If trie is '/a/b/c':
// - '/a/b'     - true.
// - '/a/b/c/d' - true, because we may have 'd' in trie, no collision.
// - '/a/b/f'   - false, we hit a point where missing child node.
func (t *PathTrie) HasPrefix(prefix string) bool {
	node := t
	for part, i := segmenter(prefix, 0); part != ""; part, i = segmenter(prefix, i) {
		if node.children == nil {
			return true
		}

		child := node.children[part]
		if child == nil {
			return false
		}

		node = child
	}

	return true
}

func (t *PathTrie) NodesCount() int {
	total := 0

	var count func(node *PathTrie)
	count = func(node *PathTrie) {
		total++
		if node.children == nil {
			return
		}

		for _, child := range node.children {
			count(child)
		}
	}

	count(t)

	return total
}

func (t *PathTrie) String() string {
	var sb strings.Builder
	var drawTrie func(node *PathTrie, prefix string, isLast bool, path string)
	drawTrie = func(node *PathTrie, prefix string, isLast bool, path string) {
		if isLast {
			sb.WriteString(prefix + "└── ")
		} else {
			sb.WriteString(prefix + "├── ")
		}
		sb.WriteString(path + "\n")

		if node.children != nil {
			keys := make([]string, 0, len(node.children))
			for k := range node.children {
				keys = append(keys, k)
			}
			for i, k := range keys {
				newPrefix := prefix
				if isLast {
					newPrefix += "    "
				} else {
					newPrefix += "│   "
				}

				childIsLast := i == len(keys)-1
				drawTrie(node.children[k], newPrefix, childIsLast, k)
			}
		}
	}

	drawTrie(t, "", true, "(root)")
	return sb.String()
}

// segmenter segments string key paths by slash separators. For example,
// "/a/b/c" -> ("/a", 2), ("/b", 4), ("/c", -1) in successive calls. It does
// not allocate any heap memory.
func segmenter(path string, start int) (segment string, next int) {
	if len(path) == 0 || start < 0 || start > len(path)-1 {
		return "", -1
	}

	end := strings.IndexRune(path[start+1:], '/') // next '/' after 0th rune
	if end == -1 {
		return path[start:], -1
	}

	return path[start : start+end+1], start + end + 1
}
