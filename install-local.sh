#!/bin/bash

# Target vault plugin directory
TARGET_DIR="/Users/fernando.abellan/Documents/Second Brain/.obsidian/plugins/elevenlabs-tts"

# Build the plugin
echo "Building plugin..."
npm run build

# Create target directory if it doesn't exist
echo "Creating target directory: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Copy files
echo "Copying files..."
cp main.js manifest.json styles.css "$TARGET_DIR/"

echo "Plugin installed successfully to $TARGET_DIR"
echo "Please reload Obsidian to see changes."
