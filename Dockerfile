# ---- Build Stage ----
  FROM node:20-alpine AS builder

  WORKDIR /app
  
  # Install pnpm
  RUN npm install -g pnpm
  
  # Copy only the dependency files first for better caching
  COPY package.json pnpm-lock.yaml ./
  COPY prisma ./prisma
  
  # Install dependencies and generate Prisma client
  RUN pnpm install --frozen-lockfile
  RUN pnpm exec prisma generate
  
  # Copy the rest of the source code
  COPY . .
  
  # Build the TypeScript code
  RUN pnpm run build
  
  # ---- Production Stage ----
  FROM node:20-alpine
  
  WORKDIR /app
  
  # Install pnpm
  RUN npm install -g pnpm
  
  # Copy only the necessary files from the builder stage
  COPY --from=builder /app/package.json ./
  COPY --from=builder /app/pnpm-lock.yaml ./
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/prisma ./prisma
  COPY --from=builder /app/dist ./dist
  
  # Expose the port Cloud Run will use
  EXPOSE 8000
  
  # Set environment variable for Cloud Run
  ENV PORT=8000
  
  # Run migrations and start the app
  CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/app.js"]