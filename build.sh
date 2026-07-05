#!/bin/bash
# Vimfari build script
# This script helps set up and build the Safari Web Extension Xcode project.
#
# Usage:
#   ./build.sh setup    - Set up the Xcode project (requires XcodeGen)
#   ./build.sh build    - Build the extension
#   ./build.sh clean    - Clean build artifacts
#   ./build.sh run      - Build and open in Safari

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/VimfariApp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

setup_project() {
    log_info "Setting up Xcode project..."

    # Check for XcodeGen
    if ! command -v xcodegen &>/dev/null; then
        log_warn "XcodeGen not found. Installing via Homebrew..."
        if ! command -v brew &>/dev/null; then
            log_error "Homebrew is required. Install from https://brew.sh"
            exit 1
        fi
        brew install xcodegen
    fi

    # Check for Xcode
    if ! command -v xcodebuild &>/dev/null; then
        log_error "Xcode is required. Install from the Mac App Store."
        exit 1
    fi

    cd "$APP_DIR"

    # Copy web extension files into SafariExtension Resources
    log_info "Copying web extension files..."
    RESOURCES_DIR="$APP_DIR/SafariExtension/Resources"
    mkdir -p "$RESOURCES_DIR"

    # Copy all web extension files
    cp "$SCRIPT_DIR/manifest.json" "$RESOURCES_DIR/" 2>/dev/null || true

    for dir in lib content_scripts background_scripts pages icons resources; do
        if [ -d "$SCRIPT_DIR/$dir" ]; then
            cp -R "$SCRIPT_DIR/$dir" "$RESOURCES_DIR/"
        fi
    done

    # Generate Xcode project
    log_info "Generating Xcode project with XcodeGen..."
    xcodegen generate

    log_info "Xcode project generated at $APP_DIR/VimfariApp.xcodeproj"
    log_info "Open it with: open $APP_DIR/VimfariApp.xcodeproj"
}

build_extension() {
    log_info "Building Vimfari..."

    cd "$APP_DIR"

    if [ ! -d "VimfariApp.xcodeproj" ]; then
        log_error "Xcode project not found. Run './build.sh setup' first."
        exit 1
    fi

    xcodebuild \
        -project VimfariApp.xcodeproj \
        -scheme VimfariApp \
        -configuration Release \
        build \
        CODE_SIGN_IDENTITY="-" \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGNING_ALLOWED=NO

    log_info "Build complete."
}

clean_build() {
    log_info "Cleaning build artifacts..."
    cd "$APP_DIR"
    rm -rf build/
    rm -rf VimfariApp.xcodeproj/
    rm -rf SafariExtension/Resources/*
    log_info "Clean complete."
}

run_extension() {
    log_info "Building and launching..."

    cd "$APP_DIR"

    if [ ! -d "VimfariApp.xcodeproj" ]; then
        log_error "Xcode project not found. Run './build.sh setup' first."
        exit 1
    fi

    # Build for running
    xcodebuild \
        -project VimfariApp.xcodeproj \
        -scheme VimfariApp \
        -configuration Debug \
        build \
        CODE_SIGN_IDENTITY="-" \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGNING_ALLOWED=NO

    # Find the built app and open it
    APP_PATH=$(find build -name "VimfariApp.app" -type d | head -1)
    if [ -n "$APP_PATH" ]; then
        log_info "Launching $APP_PATH"
        open "$APP_PATH"
    else
        log_error "Built app not found."
        exit 1
    fi
}

# Main
case "${1:-}" in
    setup)
        setup_project
        ;;
    build)
        build_extension
        ;;
    clean)
        clean_build
        ;;
    run)
        run_extension
        ;;
    *)
        echo "Usage: $0 {setup|build|clean|run}"
        echo ""
        echo "  setup  - Generate Xcode project (requires XcodeGen)"
        echo "  build  - Build the extension"
        echo "  clean  - Clean build artifacts"
        echo "  run    - Build and launch the extension"
        exit 1
        ;;
esac
