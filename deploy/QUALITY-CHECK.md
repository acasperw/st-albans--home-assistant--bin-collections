# Quality Check Notes

Build steps to verify locally before packaging:

1. Server TypeScript compile
```
cd server
npm install
npm run build
```
2. Angular production build
```
cd client
npm install
npm run build
```
3. Start server pointing at built client (optional local test)
```
cd server
node dist/server.js
# Visit http://localhost:3000
```
If index.html loads (may show CORS warnings if accessing API from dev server) the static serving path is good.
