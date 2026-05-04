# whatsapp-web.js needs Chromium, so we use a Puppeteer-ready base image.
FROM ghcr.io/puppeteer/puppeteer:23.5.0

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

WORKDIR /app

USER root
COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
RUN mkdir -p /app/.wwebjs_auth && chown -R pptruser:pptruser /app
USER pptruser

EXPOSE 3001
CMD ["node", "src/index.js"]
