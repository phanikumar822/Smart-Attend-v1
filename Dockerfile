# Use the official Node.js 20 lightweight Alpine image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies for tsx/typescript compiler)
RUN npm install

# Copy the entire codebase into the container
COPY . .

# Build the Vite React frontend for production (generates the /dist folder)
RUN npm run build

# Expose port 3000 for the Express + Vite server
EXPOSE 3000

# Set default environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Start the server using tsx to run TypeScript natively
CMD ["npx", "tsx", "server.ts"]
