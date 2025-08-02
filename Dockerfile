# Stage 1: Get Ollama
FROM ollama/ollama:latest as ollama

# Stage 2: Build the Node.js application
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# --- FIX: Only copy the Ollama binary, not the non-existent models directory ---
COPY --from=ollama /bin/ollama /usr/bin/

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Pull the lightweight, instruction-tuned model. This will create the .ollama directory.
RUN ollama serve & sleep 5 && ollama pull qwen2:0.5b-instruct-q4_0 && killall ollama

# Expose the port our Node.js app will listen on
EXPOSE 8080

# Create a startup script to run both services
RUN echo '#!/bin/bash\nollama serve &\nsleep 5\nnode main.js' > /app/start.sh && chmod +x /app/start.sh

# The command to run when the container starts
CMD ["/app/start.sh"]
