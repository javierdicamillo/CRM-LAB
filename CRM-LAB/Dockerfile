FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app/CRM-LAB
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
COPY CRM-LAB/package.json CRM-LAB/package-lock.json ./
RUN npm ci --no-fund
COPY CRM-LAB/ .
COPY contracts/ /app/contracts/
RUN npm run build

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/CRM-LAB/.next/standalone ./
COPY --from=build --chown=node:node /app/CRM-LAB/.next/static ./CRM-LAB/.next/static
COPY --from=build --chown=node:node /app/CRM-LAB/dist ./CRM-LAB/dist
COPY --from=build --chown=node:node /app/CRM-LAB/migrations ./CRM-LAB/migrations
COPY --from=build --chown=node:node /app/CRM-LAB/scripts/provision.mjs ./CRM-LAB/scripts/provision.mjs
COPY --from=build --chown=node:node /app/CRM-LAB/scripts/integration.mjs ./CRM-LAB/scripts/integration.mjs
COPY --from=build --chown=node:node /app/CRM-LAB/scripts/protocol-test.mjs ./CRM-LAB/scripts/protocol-test.mjs
WORKDIR /app/CRM-LAB
USER node
EXPOSE 3000
CMD ["node","server.js"]
