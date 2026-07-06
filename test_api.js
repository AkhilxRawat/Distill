const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Testing Distill API ===\n');

  // 1. Register
  console.log('1. POST /api/auth/register');
  const reg = await post('/api/auth/register', { username: 'apitest99', password: 'testpass123' });
  console.log(`   Status: ${reg.status}`);
  console.log(`   Body:   ${reg.body}\n`);

  // 2. Login
  console.log('2. POST /api/auth/login');
  const login = await post('/api/auth/login', { username: 'apitest99', password: 'testpass123' });
  console.log(`   Status: ${login.status}`);
  console.log(`   Body:   ${login.body}\n`);

  let token;
  try {
    token = JSON.parse(login.body).token;
    console.log(`   Token:  ${token ? token.substring(0, 30) + '...' : 'NONE'}\n`);
  } catch (e) {
    console.log('   Could not parse token\n');
    return;
  }

  if (!token) {
    console.log('No token - stopping here.');
    return;
  }

  // 3. Submit job
  console.log('3. POST /api/jobs/submit');
  const sub = await post('/api/jobs/submit', {
    source: 'https://www.youtube.com/watch?v=hD_MOQShN-s',
    sourceType: 'youtube_url'
  });
  // Attach auth
  const subAuth = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ source: 'https://www.youtube.com/watch?v=hD_MOQShN-s', sourceType: 'youtube_url' });
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/jobs/submit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Authorization': `Bearer ${token}` }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  console.log(`   Status: ${subAuth.status}`);
  console.log(`   Body:   ${subAuth.body}\n`);
}

main().catch(e => console.error('ERROR:', e.message));
