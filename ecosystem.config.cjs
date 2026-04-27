module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/server.js',
      cwd: '.',
      env_file: '.env.production',
      autorestart: true,
      restart_delay: 3000,
    },
    {
      name: 'dashboard',
      script: 'cmd.exe',
      args: '/c npm start',
      cwd: './dashboard',
      env_file: '../.env.production',
      env: {
        PORT: 3001,
      },
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
