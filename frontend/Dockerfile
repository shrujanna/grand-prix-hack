# Stage 1: Build the React/Vite application
FROM node:20-slim AS build

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Build the application for production
# This generates the static files in /app/dist
RUN npm run build

# Stage 2: Serve the built application with Nginx
FROM nginx:alpine

# Copy the custom Nginx configuration to handle SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
