# ESM Example with Vite

This example demonstrates how to use the Firestore Stripe Payments SDK with ES modules and Vite.

## Features

- ✅ ES Modules (ESM) syntax
- ✅ Vite for fast development and optimized builds
- ✅ Modern JavaScript without transpilation overhead
- ✅ Hot Module Replacement (HMR) during development
- ✅ Optimized production builds

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

4. Open http://localhost:8080 in your browser (Vite will automatically open it)

## Building for Production

```bash
npm run build
```

This will create optimized files in the `dist` directory.

To preview the production build locally:

```bash
npm run preview
```

## Key Differences from CommonJS Example

1. **Module Type**: Uses `"type": "module"` in package.json
2. **Import Syntax**: Uses ES6 `import` statements instead of `require()`
3. **Export Syntax**: Uses ES6 `export` instead of `module.exports`
4. **Build Tool**: Uses Vite instead of Webpack for faster development
5. **Configuration**: Simpler configuration with Vite's sensible defaults

## Development Tips

- Vite provides instant server start and lightning-fast HMR
- No need for complex Webpack configuration
- Built-in TypeScript support (just rename files to `.ts`)
- Automatic dependency pre-bundling for faster page loads

## Troubleshooting

If you encounter issues:

1. Make sure you're using Node.js 14+ (required for ESM support)
2. Ensure the `.tgz` file is in the correct location before installing
3. Check that your Firebase config is correctly set up
4. Verify that Firebase products are properly configured in your Firebase project
```

## Key Changes from CommonJS to ESM:

1. **Module System**: 
   - Changed from `require()` to `import`
   - Changed from `module.exports` to `export`
   - Added `"type": "module"` in package.json

2. **Build Tool**:
   - Replaced Webpack with Vite for better ESM support and faster development
   - Simpler configuration with Vite's defaults

3. **File Extensions**:
   - All imports include the `.js` extension (required for native ESM)

4. **Script Loading**:
   - Uses `<script type="module">` in HTML

5. **Development Experience**:
   - Faster startup and HMR with Vite
   - No complex bundler configuration needed

The example maintains the same functionality as the CommonJS version but leverages modern ESM syntax and Vite's development benefits.