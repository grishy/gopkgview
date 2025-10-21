# syntax=docker/dockerfile:1

#
# Stage: build the executable
#
FROM --platform=$BUILDPLATFORM golang:1.25.3-alpine3.22 AS builder
WORKDIR /build

# Use mount cache for dependencies
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=bind,source=go.sum,target=go.sum \
    --mount=type=bind,source=go.mod,target=go.mod \
    go mod download -x

ARG TARGETARCH
ARG TARGETOS
ARG VERSION=dev
ARG COMMIT=none
ARG COMMIT_DATE=unknown

# Build platform-specific
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=bind,target=. \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build \
    -trimpath \
    -ldflags="-w -s \
    -X main.version=${VERSION} \
    -X main.commit=${COMMIT} \
    -X main.date=${COMMIT_DATE}" \
    -o /bin/gopkgview

#
# Stage: run the executable
#
FROM gcr.io/distroless/static-debian12
COPY --from=builder /bin/gopkgview /gopkgview

EXPOSE 8080

ENTRYPOINT ["/gopkgview"]
CMD ["--root", "/app", "--addr", ":8080", "--skip-browser"]
