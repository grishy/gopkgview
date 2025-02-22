# syntax=docker/dockerfile:1

# STAGE 1: building the executable
FROM docker.io/golang:1.24.0-alpine3.20 as builder
WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

ENV CGO_ENABLED=0
COPY . .
RUN go build -ldflags="-w -s" -o /gopkgview

# STAGE 2: build the container to run
FROM docker.io/golang:1.24.0-alpine3.20
COPY --from=builder /gopkgview /gopkgview

EXPOSE 8080

ENTRYPOINT ["/gopkgview"]
CMD [ "--root", "/app", "--addr", ":8080", "--skip-browser" ]
