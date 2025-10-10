#!/bin/bash
# Canvas Dependencies Installation Script for VPS
# Run this script on your VPS to install required system dependencies

echo "🔧 Installing Canvas system dependencies..."

# Update package list
apt-get update

# Install Canvas dependencies
apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libfontconfig1-dev \
    pkg-config \
    python3 \
    make \
    g++

echo "✅ Canvas system dependencies installed!"
echo "🔄 Now rebuild Canvas with: npm rebuild canvas"