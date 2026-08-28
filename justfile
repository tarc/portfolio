# List available recipes
default:
    @just --list

# Install project dependencies
install:
    npm install

# Start the dev server in the background
dev:
    astro dev --background

# Stop the background dev server
dev-stop:
    astro dev stop

# Show whether the background dev server is running
dev-status:
    astro dev status

# Tail logs from the background dev server
dev-logs:
    astro dev logs

# Build the site for production
build:
    astro build

# Preview the production build locally
preview:
    astro preview
