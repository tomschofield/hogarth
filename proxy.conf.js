const PROXY_CONFIG = [
  {
    context: ['/api'],
    target: 'https://nwhy4r5874.execute-api.eu-west-2.amazonaws.com',
    secure: true,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: { '^/api': '' },
    // Spoof Origin/Host to match the domain that already works
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Origin', 'https://api.persona.design');
      proxyReq.setHeader('Host', 'api.persona.design');
    },
    // Ensure local dev responses always include an allow-origin header
    onProxyRes: (proxyRes) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:4200';
    }
  }
];

module.exports = PROXY_CONFIG;
