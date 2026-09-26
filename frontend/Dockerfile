# Stage 1 — build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 — serve with nginx; Node toolchain never reaches the final image
FROM nginx:alpine AS runtime
# Upgrade libexpat to patch CVE-2026-93990 (HIGH — fixed in 2.8.5-r0)
RUN apk upgrade --no-cache libexpat
RUN addgroup -S civicpulse && adduser -S -G civicpulse civicpulse \
    && chown -R civicpulse:civicpulse /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid && chown civicpulse:civicpulse /var/run/nginx.pid
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER civicpulse
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
