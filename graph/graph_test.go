package graph_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/grishy/gopkgview/graph"
)

func TestGraphStructure(t *testing.T) {
	tmpDir := t.TempDir()

	files := map[string]string{
		"go.mod": `module example.com/myproject
go 1.16`,
		"main.go": `package main
import "fmt"
func main() {}`,
	}

	for name, content := range files {
		path := filepath.Join(tmpDir, name)
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("failed to write %s: %v", name, err)
		}
	}

	gomodPath := filepath.Join(tmpDir, "go.mod")
	g, err := graph.New(gomodPath, tmpDir, 4)
	if err != nil {
		t.Fatalf("failed to create graph: %v", err)
	}

	// Check for stdlib package
	if len(g.Nodes()) == 0 {
		t.Error("expected non-empty nodes list")
	}

	for _, node := range g.Nodes() {
		if node.ImportPath == "fmt" && node.PkgType == graph.PkgTypeStdLib {
			return
		}
	}
	t.Error("stdlib package 'fmt' not found or incorrectly typed")
}

func TestPackageTypes(t *testing.T) {
	tmpDir := t.TempDir()

	files := map[string]string{
		"go.mod": `module example.com/myproject
go 1.20
require github.com/sirupsen/logrus v1.9.3`,

		"go.sum": `
github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
github.com/pmezard/go-difflib v1.0.0 h1:4DBwDE0NGyQoBHbLQYPwSUPoCMWR5BEzIk/f1lZbAQM=
github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
github.com/sirupsen/logrus v1.9.3 h1:dueUQJ1C2q9oE3F7wvmSGAaVtTmUizReu6fjN8uqzbQ=
github.com/sirupsen/logrus v1.9.3/go.mod h1:naHLuLoDiP4jHNo9R0sCBMtWGeIprob74mVsIT4qYEQ=
github.com/stretchr/objx v0.1.0/go.mod h1:HFkY916IF+rwdDfMAkV7OtwuqBVzrE8GR6GFx+wExME=
github.com/stretchr/testify v1.7.0 h1:nwc3DEeHmmLAfoZucVR881uASk0Mfjw8xYJ99tb5CcY=
github.com/stretchr/testify v1.7.0/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/h/Wwjteg=
golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 h1:0A+M6Uqn+Eje4kHMK80dtF3JCXC4ykBgQG4Fe06QRhQ=
golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
gopkg.in/yaml.v3 v3.0.0-20200313102051-9f266ea9e77c h1:dUUwHk2QECo/6vqA44rthZ8ie2QXMNeKRTHCNY2nXvo=
gopkg.in/yaml.v3 v3.0.0-20200313102051-9f266ea9e77c/go.mod h1:K4uyk7z7BCEPqu6E+C64Yfv1cQ7kz7rIZviUmN+EgEM=`,

		"main.go": `package main

import (
	"fmt"
	"github.com/sirupsen/logrus"
	"example.com/myproject/internal"
	"example.com/myproject/broken"
)

func main() {}`,

		"internal/internal.go": `package internal`,
	}

	for name, content := range files {
		// Create internal directory if needed
		fullpath := filepath.Join(tmpDir, name)
		if err := os.MkdirAll(filepath.Dir(fullpath), 0o755); err != nil {
			t.Fatalf("failed to create internal directory: %v", err)
		}

		if err := os.WriteFile(fullpath, []byte(content), 0o644); err != nil {
			t.Fatalf("failed to write %s: %v", name, err)
		}
	}

	gomodPath := filepath.Join(tmpDir, "go.mod")
	g, err := graph.New(gomodPath, tmpDir, 4)
	if err != nil {
		t.Fatalf("failed to create graph: %v", err)
	}

	tests := map[string]struct {
		path string
		want graph.PkgTypeEnum
	}{
		"stdlib":   {"fmt", graph.PkgTypeStdLib},
		"external": {"github.com/sirupsen/logrus", graph.PkgTypeExtLib},
		"local":    {"example.com/myproject/internal", graph.PkgTypeLocal},
		"err":      {"example.com/myproject/broken", graph.PkgTypeErr},
	}

	nodes := g.Nodes()
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			var found bool
			var got graph.PkgTypeEnum

			for _, node := range nodes {
				if node.ImportPath == tt.path {
					found = true
					got = node.PkgType
					break
				}
			}

			if !found && tt.want != graph.PkgTypeErr {
				t.Errorf("package %s not found", tt.path)
				return
			}

			if got != tt.want {
				t.Errorf("got type %v, want %v", got, tt.want)
			}
		})
	}
}
