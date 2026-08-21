ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG BASE_IMAGE
RUN test -n "${BASE_IMAGE}" \
  && GOBIN=/usr/local/bin go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.64.8 \
  && addgroup -g 1000 sandbox \
  && adduser -D -u 1000 -G sandbox sandbox
USER 1000:1000
WORKDIR /app
