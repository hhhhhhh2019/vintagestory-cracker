// tested only on 1.22.6 and 1.22.7!

'use strict'

const https = require('node:https');
const fs = require('node:fs');
const crypto = require('node:crypto');

const RSA_PRIVATE_FILENAME = 'rsa.priv';
const RSA_PUBLIC_FILENAME = 'rsa.pub';
const UUID_FILENAME = 'uuid.json';

const playerUUID = JSON.parse(fs.readFileSync(UUID_FILENAME)) || {};

const loadRSAKeys = () => {
  if (fs.existsSync(RSA_PRIVATE_FILENAME) && fs.existsSync(RSA_PUBLIC_FILENAME)) {
    console.log('use existing RSA keys');
    return { publicKey: fs.readFileSync(RSA_PUBLIC_FILENAME), privateKey: fs.readFileSync(RSA_PRIVATE_FILENAME) };
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });

    console.log(`creating new rsa keys: ${RSA_PUBLIC_FILENAME} and ${RSA_PRIVATE_FILENAME}`);
    fs.writeFileSync(RSA_PUBLIC_FILENAME, publicKey);
    fs.writeFileSync(RSA_PRIVATE_FILENAME, privateKey);

    const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });

    const modulus = Buffer.from(jwk.n, 'base64url');
    const exponent = Buffer.from(jwk.e, 'base64url');

    const xml = `<RSAKeyValue><Modulus>${modulus.toString('base64')}</Modulus><Exponent>${exponent.toString('base64')}</Exponent></RSAKeyValue>`;

    console.log(`create xml version of public key: ${RSA_PUBLIC_FILENAME + '.xml'}`);
    fs.writeFileSync(RSA_PUBLIC_FILENAME + '.xml', xml);

    return { publicKey, privateKey };
  }
}

const serverOptions = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
};

const { publicKey, privateKey } = loadRSAKeys();

const createSession = (email) => {
  const sessionKey = crypto.randomUUID();
  const signature = crypto.sign(
      'sha256',
      Buffer.from(sessionKey, 'utf8'),
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      })
    .toString('base64');

  if (!(email in playerUUID)) {
    playerUUID[email] = crypto.randomUUID();
    fs.writeSync(UUID_FILENAME, JSON.stringify(playerUUID));
  }

  const uid = playerUUID[email];

  return { sessionKey, signature, uid };
}

const validateSession = (sessionKey, signature, uid) => {
  return crypto.verify('sha256', Buffer.from(sessionKey, 'utf8'), publicKey, Buffer.from(signature, 'base64')) && (!!uid);
}

//let { sessionKey, signature, uid } = createSession();
//console.log(validateSession(sessionKey, signature, uid));

const server = https.createServer(serverOptions, (req, res) => {
  console.log(`${req.method} ${req.path}`);
  console.log('headers: ', req.headers);

  if (req.method === 'POST' && req.url == '/v2/gamelogin') {
    let body = '';

    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      console.log(`login with params: ${body}`);

      const params = new URLSearchParams(body);

      const email = params.get('email');
      /*
      const password = params.get('password');
      const totpcode = params.get('totpcode');
      const prelogintoken = params.get('prelogintoken');
      const gameloginversion =  params.get('gameloginversion');
      TODO: check if gameloginversion = 1.22.6
      TODO: what is mptoken?
      */

      const { sessionKey, signature, uid } = createSession(email);
      console.log(validateSession(sessionKey, signature, uid));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(`{"sessionkey":"${sessionKey}","mptoken":"rg62F7wtpaabxSsMm85R3EuHYSMXZFy5nSx1CsmAiac=","sessionsignature":"${signature}","uid":"${uid}","entitlements":"","playername":${email},"hasgameserver":false,"valid":1}`);
    });
  }
  else if (req.method === 'POST' && req.path == '/clientvalidate') {
    let body = '';

    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      console.log(`validate with params: ${body}`);

      const params = new URLSearchParams(body);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(`{"valid":1}`);
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(443, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.info(`Server running at: https://${host}:${port}`);
});
