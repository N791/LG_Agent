ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG BASE_IMAGE
RUN test -n "${BASE_IMAGE}" \
  && rustup component add rustfmt clippy \
  && groupadd --gid 1000 sandbox \
  && useradd --uid 1000 --gid sandbox --create-home sandbox
USER 1000:1000
WORKDIR /app
