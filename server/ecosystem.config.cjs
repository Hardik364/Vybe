module.exports = {
  apps: [{
    name:         'unibuddy-server',
    script:       'server.js',
    instances:    1,              // Socket.IO needs sticky sessions for multi-instance
    exec_mode:    'fork',
    watch:        false,
    max_memory_restart: '500M',

    env: {
      NODE_ENV: 'development',
      PORT:     3000,
    },

    env_production: {
      NODE_ENV: 'production',
      PORT:     3000,
    },

    // Auto-restart on crash
    autorestart:  true,
    restart_delay: 3000,
    max_restarts:  10,

    // Logs
    out_file:  './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }]
}
