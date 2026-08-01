// Persistent localtunnel process runner with a fixed subdomain
const localtunnel = require('localtunnel');

(async () => {
  try {
    // Request a fixed, unique subdomain to ensure the URL remains identical across restarts
    const subdomain = 'wa-automation-sandbox-3000';
    const tunnel = await localtunnel({ port: 3000, subdomain: subdomain });
    console.log(`your url is: ${tunnel.url}`);
    
    // Keep process alive indefinitely
    const intervalId = setInterval(() => {}, 1000 * 60 * 60);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
      clearInterval(intervalId);
      process.exit(1);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
      clearInterval(intervalId);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start localtunnel:', err);
    process.exit(1);
  }
})();
