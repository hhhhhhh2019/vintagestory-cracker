import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { createServer } from "node:https"
import { generateKeyPairSync, createPublicKey, sign, constants, randomUUID } from "node:crypto"

const TLS_KEY_FILENAME = 'private-key.pem';
const TLS_CERT_FILENAME = 'certificate.pem';
const RSA_PUB_FILENAME = 'pub.rsa';
const RSA_PRIV_FILENAME = 'priv.rsa';
const RSA_PUB_XML_FILENAME = 'pub.xml';
const UUID_FILENAME = 'uuid.json';

if (!existsSync(TLS_KEY_FILENAME) || !existsSync(TLS_CERT_FILENAME)) {
  console.log(`You need to generate ${TLS_KEY_FILENAME} and ${TLS_CERT_FILENAME} before starting the server. Refer to README.md for details`); 
  process.exit(1);
}

const loadRSA = () => {
  if (existsSync(RSA_PUB_FILENAME) && existsSync(RSA_PRIV_FILENAME)) {
    return {
      publicKey: readFileSync(RSA_PUB_FILENAME),
      privateKey: readFileSync(RSA_PRIV_FILENAME)
    };
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const jwk = createPublicKey(publicKey).export({ format: 'jwk' });

  const toBase64 = (base64url) => {
    let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return b64;
  };

  const modulusBase64 = toBase64(jwk.n);
  const exponentBase64 = toBase64(jwk.e);

  const xmlPublicKey = `<RSAKeyValue><Modulus>${modulusBase64}</Modulus><Exponent>${exponentBase64}</Exponent></RSAKeyValue>`;

  writeFileSync(RSA_PUB_FILENAME, publicKey);
  writeFileSync(RSA_PRIV_FILENAME, privateKey);
  writeFileSync(RSA_PUB_XML_FILENAME, xmlPublicKey);

  console.log('rsa keys generated. you need to patch VintageStoryLib.dll with new rsa key');
  process.exit(2);

  //return { publicKey, privateKey };
}

const { publicKey, privateKey } = loadRSA();

if (!existsSync(UUID_FILENAME)) {
  writeFileSync(UUID_FILENAME, '{}');
}
const playerUUID = JSON.parse(readFileSync(UUID_FILENAME)) || {};

const createSession = (email) => {
  const sessionkey = randomUUID();
  const sessionsignature = sign(
    'sha256',
    Buffer.from(sessionkey, 'utf8'),
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING
    }
  ).toString('base64');

  if (!(email in playerUUID)) {
    playerUUID[email] = crypto.randomUUID();
    writeFileSync(UUID_FILENAME, JSON.stringify(playerUUID));
  }

  const uid = playerUUID[email];

  return {
    sessionkey,
    sessionsignature,
    playername: email,
    uid
  };
}

const server = createServer({
  key: readFileSync(TLS_KEY_FILENAME),
  cert: readFileSync(TLS_CERT_FILENAME)
}, (req, res) => {
  console.log(`new request: ${req.method} ${req.url}`);
  console.log('headers:', req.headers);

  if (req.method == 'POST' && req.url == '/v2/gamelogin') {
    let body = '';

    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      console.log(`post: ${body}`);

      const params = new URLSearchParams(body);

      const email = params.get('email');

      const result = {
        valid: 1,
        reason: '',
        reasondata: '',
        sessionkey: '',
        sessionsignature: '',
        uid: '',
        playername: '',
        entitlements: '',
        prelogintoken: '',
        hasgameserver: false,
      };

      res.end(JSON.stringify({
        ...result,
        ...createSession(email)
      }));
    });
  }
});

server.listen(443, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.info(`Server running at: https://${host}:${port}`);
});
