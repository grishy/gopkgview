# gopkgview - Go dependency visualization

<p align="center">
  <img src="./frontend/public/favicon.png" width="150">
   <br />
   <strong>Status: </strong>Maintained
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/tag/grishy/gopkgview" alt="GitHub tag">
  <img src="https://goreportcard.com/badge/github.com/grishy/gopkgview" alt="Go Report Card">
  <img src="https://github.com/grishy/gopkgview/actions/workflows/release.yml/badge.svg" alt="Build Status">

**gopkgview** is an interactive tool designed to visualize and analyze Go project dependencies. It provides a rich, web-based interface for better understanding of how your project connects its components and external libraries.

Implemented with [ELK's](https://github.com/kieler/elkjs) layout algorithms to arrange the graphs and [React Flow](https://reactflow.dev/) to make the visualization interactive and user-friendly.

Example of visualization of [lazydocker](https://github.com/jesseduffield/lazydocker):

https://github.com/user-attachments/assets/d9715b85-9f77-4b2e-8ef4-1581071f1e66

## Features

- Interactive web-based visualization of Go dependencies
- Toggle dependencies by type
- Focus on specific dependencies for analysis

## Installation - 3 options

### Install via `go install`

```bash
go install github.com/grishy/gopkgview@latest
```

### Download the Release

From the latest release from the [Releases Page](https://github.com/grishy/gopkgview/releases).

### Run with Docker

```bash
docker run -p 8080:8080 -v $(pwd):/app ghcr.io/grishy/gopkgview:latest
```

## Usage

Navigate to your Go project directory and run:

```bash
cd my-go-project
gopkgview
```

This will start a web server with the dependency visualization available in your browser.

### Available Flags

```plaintext
--root value            From which directory find go.mod (default: ./) [$GO_PKGVIEW_ROOT]
--gomod value           Path to go.mod [$GO_PKGVIEW_GOMOD]
--addr value            Address to listen on (default: :0) [$GO_PKGVIEW_ADDR]
--max-goroutines value  Maximum number of goroutines to use for parsing in parallel (default: 20) [$GO_PKGVIEW_MAX_GOROUTINES]
--help, -h              show help
--version, -v           print the version
```

## Alternatives

- [go-callvis](https://github.com/ondrajz/go-callvis) - Great tool for visualizing of call, but panic on Go >= 1.21
- [godepgraph](https://github.com/kisielk/godepgraph) - Same idea, but output is static image
- [depgraph](https://github.com/becheran/depgraph) - Inspire me to create this tool
- [gomod](https://github.com/Helcaraxan/gomod)

## License

© 2024 [Sergei G.](https://github.com/grishy)  
This project is [GPL-3.0 license](./LICENSE) licensed.
