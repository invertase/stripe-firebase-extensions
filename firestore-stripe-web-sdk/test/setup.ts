// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost",
    origin: "http://localhost",
    pathname: "/",
  },
  writable: true,
});

// Mock any other browser APIs needed for the tests
global.window = window;
