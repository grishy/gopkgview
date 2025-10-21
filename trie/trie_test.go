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
			tr := trie.New()
			for _, p := range tt.paths {
				tr.Put(p)
			}

			if got, want := tr.Count(), tt.total; got != want {
				t.Log("\n" + tr.String())
				t.Errorf("unexpected total; got = %d, want = %d", got, want)
			}
		})
	}
}

func runPrefixTest(t *testing.T, paths []string, prefixes map[string]bool) {
	t.Helper()
	tr := trie.New()
	for _, p := range paths {
		tr.Put(p)
	}

	for prefix, want := range prefixes {
		if got := tr.HasPrefix(prefix); got != want {
			t.Log("\n" + tr.String())
			t.Errorf("PrefixCheck(%q) = %v, want %v", prefix, got, want)
		}
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
				// Because trie is empty with no children for root node.
				// I think it good behavior if we don't have any paths in trie return false.
				// It can be edge case, if no any deps and not miss with STD lib.
				"a": false,
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
		{
			name: "go import paths",
			paths: []string{
				"github.com/user/repo",
				"github.com/user/repo/pkg",
				"golang.org/x/tools",
				"golang.org/x/tools/go/analysis",
			},
			prefixes: map[string]bool{
				"github.com":                     true,
				"github.com/user":                true,
				"github.com/user/repo":           true,
				"github.com/user/repo/pkg":       true,
				"github.com/user/repo/pkg/other": true, // like subpath of existing path
				"golang.org":                     true,
				"golang.org/x":                   true,
				"golang.org/x/tools":             true,
				"golang.org/x/tools/go":          true,
				"golang.org/x/tools/go/analysis": true,
				"golang.org/x/tools/go/packages": false,
				"k8s.io":                         false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			runPrefixTest(t, tt.paths, tt.prefixes)
		})
	}
}
