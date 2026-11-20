FROM node:22-alpine

WORKDIR /app
COPY package.json server.mjs ./

# Run as the unprivileged user that ships with the node image.
USER node

ENV PORT=8787 HOST=0.0.0.0
EXPOSE 8787

# Pass DISCORD_BOT_TOKEN at runtime (docker run -e DISCORD_BOT_TOKEN=...), never at build time.
CMD ["node", "server.mjs"]
