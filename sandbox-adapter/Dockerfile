FROM docker.io/cloudflare/sandbox:0.12.7

ARG SKILLS_CLI_VERSION=1.5.23

# Keep the official CLI and its dependency tree inside the image so each
# verification does not spend its timeout downloading the CLI through npx.
RUN mkdir -p /opt/skillbase-cli \
  && cd /opt/skillbase-cli \
  && npm init -y >/dev/null 2>&1 \
  && npm install --omit=dev --no-audit --no-fund skills@${SKILLS_CLI_VERSION} \
  && /opt/skillbase-cli/node_modules/.bin/skills --version

ENV SKILLS_CLI_VERSION=${SKILLS_CLI_VERSION}
ENV SKILLBASE_CLI_PREFIX=/opt/skillbase-cli

EXPOSE 8080
