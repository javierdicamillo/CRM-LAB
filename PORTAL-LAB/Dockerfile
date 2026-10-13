# Build from repository root: docker build -f PORTAL-LAB/Dockerfile -t portal-lab:0.1.0 .
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app/PORTAL-LAB
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
COPY PORTAL-LAB/package.json PORTAL-LAB/package-lock.json ./
RUN npm ci --no-fund
COPY PORTAL-LAB/ .
COPY contracts/ /app/contracts/
RUN npm run build

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3100
COPY --from=build --chown=node:node /app/PORTAL-LAB/.next/standalone ./
COPY --from=build --chown=node:node /app/PORTAL-LAB/public ./PORTAL-LAB/public
COPY --from=build --chown=node:node /app/PORTAL-LAB/.next/static ./PORTAL-LAB/.next/static
COPY --from=build --chown=node:node /app/PORTAL-LAB/dist ./PORTAL-LAB/dist
COPY --from=build --chown=node:node /app/PORTAL-LAB/migrations ./PORTAL-LAB/migrations
WORKDIR /app/PORTAL-LAB
USER node
EXPOSE 3100
CMD ["node","server.js"]
