# AGENTS.md - P2P File Sharing Project

## Build/Lint/Test Commands

- **Start server**: `npm start` or `node server.js`
- **Install dependencies**: `npm install`
- **Test**: No tests configured yet - placeholder script exists
- **Lint**: No linting configured - consider adding ESLint
- **Format**: No formatter configured - consider adding Prettier

## Code Style Guidelines

### General
- Use CommonJS modules (`require`/`module.exports`)
- Follow camelCase naming for variables and functions
- Use descriptive, meaningful variable names
- Add extensive console logging for debugging WebSocket/WebRTC operations

### Imports and Dependencies
- Group imports: Node.js core modules first, then third-party, then local
- Use `const` for all module imports
- Example: `const express = require('express');`

### Error Handling
- Use try-catch blocks for JSON parsing and async operations
- Log errors with `console.error()` and provide context
- Update UI status on errors with user-friendly messages

### WebRTC/WebSocket Patterns
- Always check connection states before operations
- Handle ICE candidates and connection state changes
- Use STUN servers for NAT traversal
- Validate message types before processing

### Code Organization
- Group related functionality (event listeners, helper functions)
- Use clear function names that describe their purpose
- Separate client-side and server-side logic into different files

### Security
- Validate all incoming WebSocket messages
- Sanitize file operations and user inputs
- Use secure WebSocket connections in production

### Performance
- Clean up event listeners and connections when done
- Handle large file transfers with proper chunking
- Monitor connection states to avoid memory leaks