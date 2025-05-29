# CommonJS Example

This example demonstrates how to use the Firestore Stripe Payments SDK with CommonJS and Webpack.

## Setup

1. Copy `src/firebase-config.example.js` to `src/firebase-config.js` and fill in your Firebase configuration:
   ```bash
   cp src/firebase-config.example.js src/firebase-config.js
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:8080 in your browser

## Building for Production

```bash
npm run build
```

This will create optimized files in the `dist` directory.