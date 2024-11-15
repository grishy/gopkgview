package trie_test

import (
	"testing"

	"github.com/grishy/gopkgview/trie"
)

func TestPathTrie(t *testing.T) {
	tests := []struct {
		name  string
		paths []string
		total int
	}{
		{
			name:  "empty trie",
			paths: []string{},
			total: 1, // root node always exists
		},
		{
			name:  "single path",
			paths: []string{"/a/b/c"},
			total: 4,
		},
		{
			name: "multiple paths",
			paths: []string{
				"/a/b/c",
				"/a/b/d",
				"/x/y/z",
			},
			total: 8,
		},
		{
			name: "nested paths",
			paths: []string{
				"/a",
				"/a/b",
				"/a/b/c",
			},
			total: 4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tr := trie.NewPathTrie()
			for _, p := range tt.paths {
				tr.Put(p)
			}

			if got, want := tr.NodesCount(), tt.total; got != want {
				t.Log("\n" + tr.String())
				t.Errorf("unexpected total; got = %d, want = %d", got, want)
			}
		})
	}
}

func TestPathTriePrefixCheck(t *testing.T) {
	tests := []struct {
		name     string
		paths    []string
		prefixes map[string]bool
	}{
		{
			name:  "empty trie",
			paths: []string{},
			prefixes: map[string]bool{
				"/a": true, // root node always exists
			},
		},
		{
			name:  "single path",
			paths: []string{"/a/b/c"},
			prefixes: map[string]bool{
				"/a":     true,
				"/a/b":   true,
				"/a/b/c": true,
				"/x":     false,
				"/a/b/d": false,
			},
		},
		{
			name: "multiple paths",
			paths: []string{
				"/a/b/c",
				"/a/b/d",
				"/x/y/z",
			},
			prefixes: map[string]bool{
				"/a":     true,
				"/a/b":   true,
				"/a/b/c": true,
				"/a/b/d": true,
				"/x":     true,
				"/x/y":   true,
				"/x/y/z": true,
				"/b":     false,
				"/a/c":   false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tr := trie.NewPathTrie()
			for _, p := range tt.paths {
				tr.Put(p)
			}

			for prefix, want := range tt.prefixes {
				if got := tr.HasPrefix(prefix); got != want {
					t.Log("\n" + tr.String())
					t.Errorf("PrefixCheck(%q) = %v, want %v", prefix, got, want)
				}
			}
		})
	}
}
