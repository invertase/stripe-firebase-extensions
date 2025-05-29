# CommonJS Example

This example demonstrates how to use the Firestore Stripe Payments SDK with CommonJS and Webpack.

## Setup

1. Copy `.env.example` to `.env` and fill in your Firebase configuration:
   ```bash
   cp .env.example .env
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

## Important Notes

### Development with npm link

If you're developing the SDK locally and using `npm link`, the webpack aliases in `webpack.config.js` are required to prevent multiple Firebase instances:

```javascript
resolve: {
  alias: {
    "firebase/app": path.resolve(__dirname, "node_modules/firebase/app"),
    "firebase/firestore": path.resolve(__dirname, "node_modules/firebase/firestore"),
    "firebase/auth": path.resolve(__dirname, "node_modules/firebase/auth"),
  },
}
```

### Production Usage

When installing the SDK from npm (not using npm link), these aliases are not necessary and can be removed from your webpack configuration.

## Building for Production

```bash
npm run build
```

This will create optimized files in the `dist` directory.