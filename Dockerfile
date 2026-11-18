# One image definition for all three services. Pick the service with the APP build argument:
#   docker build --build-arg APP=web .      (dashboard, port 3000)
#   docker build --build-arg APP=ingest .   (ingest API, port 4318)
#   docker build --build-arg APP=worker .   (queue worker, no port)
FROM node:26-slim AS build
RUN npm install -g pnpm@12.14.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG APP
RUN test -n "$APP" || (echo "Pass --build-arg APP=web|ingest|worker" && exit 1)
RUN pnpm turbo run build --filter="@promptscope/${APP}..." --filter=@promptscope/db
RUN pnpm --filter "@promptscope/${APP}" deploy --prod /out \
  && mkdir -p /out/migrate \
  && cp -r packages/db/dist/. /out/migrate/ \
  && cp -r packages/db/drizzle /out/drizzle

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
CMD ["npm", "start"]
