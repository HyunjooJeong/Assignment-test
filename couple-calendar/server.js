const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { StringDecoder } = require('string_decoder');

const PORT = process.env.PORT || 3000;
const dataPath = path.join(__dirname, 'data.json');
const publicPath = path.join(__dirname, 'public');
const subscribers = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function loadData() {
  if (!fs.existsSync(dataPath)) {
    const initial = { users: [], couples: [], user_couples: [], events: [] };
    fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(dataPath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { users: [], couples: [], user_couples: [], events: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getNow() {
  return new Date().toISOString();
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  let pathname = parsed.pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(publicPath, pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { message: '파일을 찾을 수 없습니다.' });
    return;
  }
  const ext = path.extname(filePath);
  const mime = mimeTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
}

function parseBody(req, callback) {
  const decoder = new StringDecoder('utf-8');
  let body = '';
  req.on('data', (chunk) => {
    body += decoder.write(chunk);
  });
  req.on('end', () => {
    body += decoder.end();
    if (!body) return callback(null, {});
    try {
      callback(null, JSON.parse(body));
    } catch (error) {
      callback(error);
    }
  });
}

function getUserCouple(data, userId) {
  const relation = data.user_couples.find((item) => item.user_id === userId);
  if (!relation) return null;
  return data.couples.find((item) => item.couple_id === relation.couple_id) || null;
}

function notifyCouple(coupleId, payload) {
  const list = subscribers.get(coupleId);
  if (!list) return;
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  list.forEach((res) => res.write(message));
}

function handleApi(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;
  const data = loadData();

  if (method === 'POST' && pathname === '/api/users') {
    parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { message: '유효하지 않은 JSON입니다.' });
      const { name, email } = body;
      if (!name) return sendJson(res, 400, { message: '이름을 입력해주세요.' });
      if (email && data.users.some((item) => item.email === email)) {
        return sendJson(res, 400, { message: '이미 존재하는 이메일입니다.' });
      }
      const id = data.users.length ? data.users[data.users.length - 1].id + 1 : 1;
      const user = { id, name, email: email || '', created_at: getNow() };
      data.users.push(user);
      saveData(data);
      sendJson(res, 200, { user });
    });
    return;
  }

  if (method === 'GET' && pathname.startsWith('/api/users/')) {
    const id = Number(pathname.split('/').pop());
    const user = data.users.find((item) => item.id === id);
    if (!user) return sendJson(res, 404, { message: '사용자를 찾을 수 없습니다.' });
    return sendJson(res, 200, { user });
  }

  if (method === 'POST' && pathname === '/api/invite') {
    parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { message: '유효하지 않은 JSON입니다.' });
      const user_id = Number(body.user_id);
      if (!user_id) return sendJson(res, 400, { message: 'user_id가 필요합니다.' });
      const user = data.users.find((item) => item.id === user_id);
      if (!user) return sendJson(res, 404, { message: '사용자를 찾을 수 없습니다.' });
      const existing = getUserCouple(data, user_id);
      if (existing) {
        return sendJson(res, 200, { couple_id: existing.couple_id, invite_code: existing.invite_code });
      }
      const invite_code = generateInviteCode();
      const couple_id = data.couples.length ? data.couples[data.couples.length - 1].couple_id + 1 : 1;
      data.couples.push({ couple_id, invite_code, created_at: getNow() });
      data.user_couples.push({ user_id, couple_id });
      saveData(data);
      sendJson(res, 200, { couple_id, invite_code });
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/invite/accept') {
    parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { message: '유효하지 않은 JSON입니다.' });
      const user_id = Number(body.user_id);
      const invite_code = String(body.invite_code || '').trim().toUpperCase();
      if (!user_id || !invite_code) return sendJson(res, 400, { message: 'user_id와 invite_code가 필요합니다.' });
      const user = data.users.find((item) => item.id === user_id);
      if (!user) return sendJson(res, 404, { message: '사용자를 찾을 수 없습니다.' });
      const couple = data.couples.find((item) => item.invite_code === invite_code);
      if (!couple) return sendJson(res, 404, { message: '유효한 초대 코드가 아닙니다.' });
      const existing = getUserCouple(data, user_id);
      if (existing && existing.couple_id !== couple.couple_id) {
        return sendJson(res, 400, { message: '이미 다른 파트너와 연결되어 있습니다.' });
      }
      if (!data.user_couples.some((item) => item.user_id === user_id && item.couple_id === couple.couple_id)) {
        data.user_couples.push({ user_id, couple_id: couple.couple_id });
        saveData(data);
      }
      sendJson(res, 200, { couple_id: couple.couple_id, invite_code: couple.invite_code });
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/events') {
    const couple_id = Number(parsed.query.couple_id);
    if (!couple_id) return sendJson(res, 400, { message: 'couple_id가 필요합니다.' });
    const events = data.events.filter((item) => item.couple_id === couple_id).sort((a, b) => a.start.localeCompare(b.start));
    return sendJson(res, 200, { events });
  }

  if (method === 'POST' && pathname === '/api/events') {
    parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { message: '유효하지 않은 JSON입니다.' });
      const couple_id = Number(body.couple_id);
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const start = String(body.start || '').trim();
      const end = String(body.end || '').trim();
      const created_by = Number(body.created_by);
      if (!couple_id || !title || !start || !end || !created_by) {
        return sendJson(res, 400, { message: '모든 필드를 입력해주세요.' });
      }
      if (!data.couples.some((item) => item.couple_id === couple_id)) {
        return sendJson(res, 404, { message: '유효한 couple_id가 아닙니다.' });
      }
      if (!data.users.some((item) => item.id === created_by)) {
        return sendJson(res, 404, { message: '생성자를 찾을 수 없습니다.' });
      }
      const id = data.events.length ? data.events[data.events.length - 1].id + 1 : 1;
      const event = { id, couple_id, title, description, start, end, created_by, created_at: getNow(), updated_at: getNow() };
      data.events.push(event);
      saveData(data);
      notifyCouple(couple_id, { type: 'created', event });
      sendJson(res, 200, { event });
    });
    return;
  }

  if ((method === 'PUT' || method === 'DELETE') && pathname.startsWith('/api/events/')) {
    const id = Number(pathname.split('/').pop());
    if (!id) return sendJson(res, 400, { message: '유효한 이벤트 ID가 필요합니다.' });
    const eventIndex = data.events.findIndex((item) => item.id === id);
    if (eventIndex === -1) return sendJson(res, 404, { message: '이벤트를 찾을 수 없습니다.' });
    const existing = data.events[eventIndex];
    if (method === 'DELETE') {
      data.events.splice(eventIndex, 1);
      saveData(data);
      notifyCouple(existing.couple_id, { type: 'deleted', event: { id } });
      return sendJson(res, 200, { message: '이벤트가 삭제되었습니다.' });
    }
    parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { message: '유효하지 않은 JSON입니다.' });
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const start = String(body.start || '').trim();
      const end = String(body.end || '').trim();
      if (!title || !start || !end) {
        return sendJson(res, 400, { message: '모든 필드를 입력해주세요.' });
      }
      existing.title = title;
      existing.description = description;
      existing.start = start;
      existing.end = end;
      existing.updated_at = getNow();
      saveData(data);
      notifyCouple(existing.couple_id, { type: 'updated', event: existing });
      sendJson(res, 200, { event: existing });
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/events/stream') {
    const couple_id = Number(parsed.query.couple_id);
    if (!couple_id) return sendJson(res, 400, { message: 'couple_id가 필요합니다.' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(': connected\n\n');
    const list = subscribers.get(couple_id) || [];
    list.push(res);
    subscribers.set(couple_id, list);
    req.on('close', () => {
      const current = subscribers.get(couple_id) || [];
      subscribers.set(couple_id, current.filter((item) => item !== res));
    });
    return;
  }

  return serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      return handleApi(req, res);
    }
    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { message: '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, () => {
  console.log(`커플 캘린더 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
