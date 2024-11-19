# gopkgview - Go dependency visualization

<p align="center">
  <img src="./frontend/public/favicon.png" width="150">
   <br />
   <strong>Status: </strong>Maintained
</p>

<!-- TODO: Use correct URLs -->
<p align="center">
  <img src="https://img.shields.io/github/v/tag/grishy/go-avahi-cname" alt="GitHub tag (with filter)">
  <img src="https://goreportcard.com/badge/github.com/grishy/go-avahi-cname" alt="Go Report Card">
  <img src="https://github.com/grishy/go-avahi-cname/actions/workflows/release.yml/badge.svg" alt="Build Status">
</p>

A Go package dependency visualization tool that helps you understand and analyze your Go project dependencies.

Example of visualization of [lazydocker](https://github.com/jesseduffield/lazydocker):

https://github.com/user-attachments/assets/d9715b85-9f77-4b2e-8ef4-1581071f1e66

## Features

- Rich web visualization of Go dependencies
- Allow to on/off dependencies per type
- Select only subset of dependencies for visualization

<!-- TODO: Add go releaser -->

## Installation - 3 options

1. Install the latest version by running:

```bash
go install github.com/grishy/gopkgview@latest
```

2. Download the latest release from the [releases page]()
3. Docker image

```bash
docker run -p 8080:8080 -v $(pwd):/app grishy/gopkgview
```

## Usage

Navigate to your Go project directory and run:

```bash
# In the root of your Go project
gopkgview
```

### Flags

```plaintext
--root value            From which directory find go.mod (default: ./) [$GO_PKGVIEW_ROOT]
--gomod value           Path to go.mod [$GO_PKGVIEW_GOMOD]
--addr value            Address to listen on (default: :0) [$GO_PKGVIEW_ADDR]
--max-goroutines value  Maximum number of goroutines to use for parsing in parallel (default: 20) [$GO_PKGVIEW_MAX_GOROUTINES]
--help, -h              show help
--version, -v           print the version
```

## Alternatives

- [go-callvis](https://github.com/ondrajz/go-callvis)
- [godepgraph](https://github.com/kisielk/godepgraph)

## License

© 2024 [Sergei G.](https://github.com/grishy)  
This project is [GPL-3.0 license](./LICENSE) licensed.
