# Use Node 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies with Yarn
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Run database generation and build
RUN yarn db:generate
RUN yarn build

# Expose the service port
EXPOSE 3002

# Start the service
CMD ["node", "dist/index.js"]
