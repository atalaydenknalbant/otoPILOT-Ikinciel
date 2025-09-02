# Stage 1: Get Ollama
FROM ollama/ollama:latest as ollama

# Stage 2: Build the Node.js application
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

WORKDIR /app

# --- FIX: Install psmisc to get the 'killall' command ---
RUN apt-get update && apt-get install -y psmisc

# Copy Ollama binary from the first stage
COPY --from=ollama /bin/ollama /usr/bin/

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# --- FIX: Update to the new, smaller model ---
RUN ollama serve & sleep 5 && ollama pull qwen2.5:0.5b && killall ollama

# Expose the port our Node.js app will listen on
EXPOSE 8080

# Create a startup script to run both services
RUN echo '#!/bin/bash\nollama serve &\nsleep 5\nnode main.js' > /app/start.sh && chmod +x /app/start.sh

# The command to run when the container starts
CMD ["/app/start.sh"]