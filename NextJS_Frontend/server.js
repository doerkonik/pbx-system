/**
 * HTTPS wrapper around the Next.js production build.
 *
 * `next start` only speaks HTTP, but the agent softphone needs a secure
 * context: browsers refuse getUserMedia (microphone) on a plain-HTTP origin
 * reached by IP, which silently kills the WebRTC call audio. Serving the
 * frontend over TLS with the same cert as the backend keeps the whole origin
 * secure.
 *
 * Cert/key default to the repo's certs/ pair and are overridable via env so
 * nothing about the host is hardcoded.
 */
const { createServer } = require('node:https');
const { readFileSync } = require('node:fs');
const { parse } = require('node:url');
const path = require('node:path');
const next = require('next');

const port = Number(process.env.PORT || 3002);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

const certFile =
  process.env.TLS_CERT_FILE || path.join(__dirname, '..', 'certs', 'pbx.crt');
const keyFile =
  process.env.TLS_KEY_FILE || path.join(__dirname, '..', 'certs', 'pbx.key');

const httpsOptions = {
  cert: readFileSync(certFile),
  key: readFileSync(keyFile),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, hostname, () => {
    console.log(`PBX frontend listening on https://${hostname}:${port} (dev=${dev})`);
  });
});
