# Use Node 16 as the base image
FROM node:16-buster

# Install system dependencies for media (FFmpeg, ImageMagick, WebP)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /root/King-M

# Copy package files and install npm dependencies
COPY package.json .
RUN npm install

# Copy the rest of the bot's source code
COPY . .

# Start the bot using the optimized memory command from your Procfile
CMD ["node", "--optimize_for_size", "--max_old_space_size=460", "index.js"]
