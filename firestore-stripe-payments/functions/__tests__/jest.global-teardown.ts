export default async function globalTeardown() {
  if (global.stripeListenProcess) {
    global.stripeListenProcess.kill();
    global.stripeListenProcess = null;
  }
}
