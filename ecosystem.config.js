module.exports = {
  apps: [
    {
      name: "ttime",
      script: "server.js", // veya senin ana dosyan hangisiyse!
      watch: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
