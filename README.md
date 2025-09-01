# A p2p file sharing WebUI using webRTC

## STEPS

1. Clone the repository:
   ```bash
   git clone https://github.com/daschinmoy21/Xender.git
   ```
2. Navigate into the project directory:
   ```bash
   cd Xender
   ```
3. Run the server:
   ```bash
   bun server.js
   ```

#Project was built/initialized using Bun but should work with NodeJS.
However it is recommended to use Bun.

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
