module.exports = {
  apps: [
    {
      name: 'escuela-backend',
      cwd: __dirname,
      script: './node_modules/.bin/tsx',
      args: 'src/index.ts',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
