# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

- Install dependencies: `npm install`
- Lint JS code: `npm run lint`
- Build client: `npm run build` (runs lint automatically)
- Build server: `go build`
- Run server: `./webrtc-chess` (runs on port 8080 by default)

## Code Style Guidelines

### JavaScript

- Use strict mode ('use strict')
- Follow Google ESLint configuration
- Use 2-space indentation
- Use single quotes for strings
- Add JSDoc comments for functions with parameter documentation
- Use camelCase for function and variable names
- Use ES6 modules (import/export)

### Go

- Follow standard Go formatting with gofmt
- Use CamelCase for exported functions/variables
- Use camelCase for non-exported functions/variables
- Simple error handling with log.Fatal for critical errors

## Project Structure

- `/app`: Client-side code (JS, CSS, HTML)
- `/dist`: Built client assets (generated)
- Root: Server-side Go code and configuration files
