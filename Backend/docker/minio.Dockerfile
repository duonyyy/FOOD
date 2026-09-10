ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z

FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE
RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth 1 --branch "${MINIO_RELEASE}" https://github.com/minio/minio.git .
RUN MINIO_LDFLAGS="$(go run buildscripts/gen-ldflags.go)" \
    && CGO_ENABLED=0 go build -tags kqueue -trimpath \
      --ldflags "${MINIO_LDFLAGS}" -o /out/minio .

FROM alpine:3.20
RUN apk add --no-cache curl su-exec \
    && addgroup -S minio && adduser -S minio -G minio \
    && mkdir -p /data \
    && chown -R minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio
COPY docker/minio-entrypoint.sh /usr/local/bin/minio-entrypoint
RUN chmod 755 /usr/local/bin/minio-entrypoint
VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/minio-entrypoint"]
CMD ["server", "/data"]
