# Stage 1: Get Ollama
FROM ollama/ollama:latest as ollama

# Stage 2: Build the Node.js application
FROM mcr.microsoft.com/playwright/javascript:v1.45.1-jammy

WORKDIR /app

# Copy Ollama binary and models from the first stage
COPY --from=ollama /bin/ollama /usr/bin/
COPY --from=ollama /root/.ollama /root/.ollama

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# --- FIX: Pull the instruction-tuned model ---
# This bakes the correct model directly into the Docker image.
RUN ollama serve & sleep 5 && ollama pull gemma:2b-instruct && killall ollama

# Expose the port our Node.js app will listen on
EXPOSE 8080

# Create a startup script to run both services
RUN echo '#!/bin/bash\nollama serve &\nsleep 5\nnode main.js' > /app/start.sh && chmod +x /app/start.sh

# The command to run when the container starts
CMD ["/app/start.sh"]