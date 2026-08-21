ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG BASE_IMAGE
RUN test -n "${BASE_IMAGE}" \
  && pip install --no-cache-dir pytest==8.3.5 ruff==0.9.10 uv==0.6.5 \
  && groupadd --gid 1000 sandbox \
  && useradd --uid 1000 --gid sandbox --create-home sandbox
USER 1000:1000
WORKDIR /app
