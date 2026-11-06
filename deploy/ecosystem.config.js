// pm2 process definition.
//
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
//   pm2 startup systemd      # run the command it prints, once, so it survives reboots
//
// Secrets are NOT set here; they come from /var/www/lotus/.env.production,
// which Next.js reads at startup. Only the memory limit lives here because it
// has to be passed to Node itself, before the app loads.

module.exports = {
  apps: [
    {
      name: "lotus",
      cwd: "/var/www/lotus",
      script: "server.js",            // produced by `next build` (output: standalone)
      instances: 1,                   // the in-memory database requires a single process
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      // Node caps its heap at ~2 GB by default regardless of machine RAM. The app
      // holds the whole database in memory and the cap was reached in production.
      node_args: "--max-old-space-size=6144",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",        // only nginx should be able to reach it
        LOTUS_PROD: "1",
      },
      out_file: "/root/.pm2/logs/lotus-out.log",
      error_file: "/root/.pm2/logs/lotus-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
