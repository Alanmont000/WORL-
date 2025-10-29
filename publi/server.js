// server.js - WORLΔ prototype server WITHOUT payment endpoints.
// Provides: static files, REST auth (simple), /api/me, SQLite persistence, WebSocket simple multplayer (positions & chat).
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 4000;
const PUBLIC = path.join(__dirname, 'public');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'publi')));


// --- Simple SQLite setup ---
const dbFile = path.join(__dirname, 'data.sqlite3');
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    fragments INTEGER DEFAULT 120,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_spent REAL DEFAULT 0.0,
    vip INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_key TEXT,
    qty INTEGER DEFAULT 1
  )`);
});

// --- Helper functions ---
function sendJson(res, obj){ res.json(obj); }
function calcLevelFromXP(xp){
  return Math.min(50, Math.floor(Math.sqrt(xp/200))+1);
}

// --- Auth endpoints (very simple, not production-secure) ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return sendJson(res, { ok:false, error:'missing' });
  db.run(`INSERT INTO users (username,password) VALUES (?,?)`, [username, password], function(err){
    if(err) return sendJson(res, { ok:false, error: 'user_exists' });
    sendJson(res, { ok:true, userId: this.lastID });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return sendJson(res, { ok:false, error:'missing' });
  db.get(`SELECT id,username,fragments,xp,level,vip FROM users WHERE username=? AND password=?`, [username,password], (err,row)=>{
    if(err) return sendJson(res,{ok:false,error:'db'});
    if(!row) return sendJson(res,{ok:false,error:'invalid'});
    sendJson(res,{ ok:true, user: row });
  });
});

app.get('/api/me', (req, res) => {
  const userId = Number(req.query.userId || 0);
  if(!userId){
    return sendJson(res, { ok:true, user: { id:0, username:'Invitado', fragments:120, xp:0, level:1, vip:0 } });
  }
  db.get(`SELECT id,username,fragments,xp,level,vip FROM users WHERE id=?`, [userId], (err,row)=>{
    if(err) return sendJson(res,{ok:false,error:'db'});
    if(!row) return sendJson(res,{ok:false,error:'notfound'});
    sendJson(res,{ ok:true, user: row });
  });
});

app.post('/api/grant-fragments', (req,res) => {
  const { userId, amount } = req.body;
  if(!userId || !amount) return sendJson(res,{ok:false,error:'missing'});
  db.run(`UPDATE users SET fragments = fragments + ? WHERE id=?`, [amount, userId], function(err){
    if(err) return sendJson(res,{ok:false,error:'db'});
    sendJson(res,{ ok:true, credited: amount });
  });
});

app.post('/api/save', (req,res)=>{
  const { userId, xp, fragments } = req.body;
  if(!userId) return sendJson(res,{ok:false,error:'missing'});
  db.get(`SELECT xp FROM users WHERE id=?`, [userId], (err,row)=>{
    if(err) return sendJson(res,{ok:false,error:'db'});
    const newXp = (row? row.xp : 0) + (xp||0);
    const newLevel = calcLevelFromXP(newXp);
    db.run(`UPDATE users SET xp=?, level=?, fragments=? WHERE id=?`, [newXp, newLevel, fragments||0, userId], function(err){
      if(err) return sendJson(res,{ok:false,error:'db'});
      sendJson(res,{ ok:true, xp:newXp, level:newLevel });
    });
  });
});

app.get('*', (req,res)=>{
  res.sendFile(path.join(PUBLIC,'index.html'));
});

// --- WebSocket multplayer ---
let clients = new Map();
wss.on('connection', (ws, req) => {
  ws.id = Math.random().toString(36).slice(2,9);
  clients.set(ws, { id: ws.id, username: 'Invitado' });
  ws.send(JSON.stringify({ t:'welcome', id: ws.id }));
  broadcastPlayers();

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }
    if(data.t === 'join'){
      clients.set(ws, { id: ws.id, username: data.username || 'Invitado', userId: data.userId || 0 });
      broadcastPlayers();
    } else if(data.t === 'pos'){
      const payload = { t:'pos', id: clients.get(ws).id, x: data.x, y: data.y, z: data.z, rx: data.rx, ry: data.ry, username: clients.get(ws).username };
      wss.clients.forEach(c=>{ if(c.readyState === 1) c.send(JSON.stringify(payload)); });
    } else if(data.t === 'chat'){
      const payload = { t:'chat', id: clients.get(ws).id, username: clients.get(ws).username, text: data.text };
      wss.clients.forEach(c=>{ if(c.readyState === 1) c.send(JSON.stringify(payload)); });
    }
  });

  ws.on('close', ()=>{
    clients.delete(ws);
    broadcastPlayers();
  });
});

function broadcastPlayers(){
  const list = [];
  clients.forEach((v,k)=>{
    list.push({ id: v.id, username: v.username, userId: v.userId || 0 });
  });
  const msg = JSON.stringify({ t:'players', list });
  wss.clients.forEach(c=>{ if(c.readyState === 1) c.send(msg); });
}

server.listen(PORT, ()=> console.log(`WORLΔ demo server (no-payments) listening on ${PORT}`));
