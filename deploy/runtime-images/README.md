# Runtime images

Each build must pass a digest-pinned `BASE_IMAGE` (`name@sha256:...`). Publish the result,
run `.github/workflows/runtime-image-governance.yml`, and copy the resulting digest into the
corresponding `SANDBOX_*_IMAGE` deployment secret. The images deliberately contain compilers
and quality tools but no source-control credentials.

Example:

```sh
docker build --build-arg BASE_IMAGE=python:3.12-slim@sha256:<digest> \
  -t registry.example/runtime-python:3.12 python
```
