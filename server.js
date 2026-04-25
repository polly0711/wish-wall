require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const os = require('os');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB Connection ───────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || MONGODB_URI.includes('你的帳號')) {
  console.error('\n❌ 請先在 .env 檔案中設定您的 MongoDB Atlas 連線字串 (MONGODB_URI)');
  console.error('   範例: MONGODB_URI=mongodb+srv://user:pass@cluster0.xxx.mongodb.net/wishwall\n');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ 已成功連接 MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB 連線失敗:', err.message);
    process.exit(1);
  });

// ── Wish Model ───────────────────────────────────────────────────
const wishSchema = new mongoose.Schema({
  name:       { type: String, required: true, maxlength: 30 },
  content:    { type: String, required: true, maxlength: 200 },
  created_at: { type: Date, default: Date.now }
});

const Wish = mongoose.model('Wish', wishSchema);

// ── Helper: get local IP ─────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ── Middleware: verify admin password ─────────────────────────────
function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'] || req.body.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '管理員密碼不正確' });
  }
  next();
}

// ── API Routes ───────────────────────────────────────────────────

// Get all wishes
app.get('/api/wishes', async (req, res) => {
  try {
    const wishes = await Wish.find().sort({ created_at: -1 });
    res.json(wishes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a wish
app.post('/api/wishes', async (req, res) => {
  const { name, content } = req.body;

  if (!name || !content) {
    return res.status(400).json({ error: '姓名和心願都不能為空' });
  }
  if (content.length > 200) {
    return res.status(400).json({ error: '心願不可超過 200 字' });
  }
  if (name.length > 30) {
    return res.status(400).json({ error: '姓名不可超過 30 字' });
  }

  try {
    const wish = await Wish.create({ name, content });
    const wishObj = {
      _id: wish._id,
      name: wish.name,
      content: wish.content,
      created_at: wish.created_at
    };

    // Broadcast to all connected display screens
    io.emit('new-wish', wishObj);

    res.json({ success: true, wish: wishObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin login verification
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密碼不正確' });
  }
});

// Edit a wish (admin only)
app.put('/api/wishes/:id', requireAdmin, async (req, res) => {
  const { name, content } = req.body;

  if (!name || !content) {
    return res.status(400).json({ error: '姓名和心願都不能為空' });
  }
  if (content.length > 200) {
    return res.status(400).json({ error: '心願不可超過 200 字' });
  }
  if (name.length > 30) {
    return res.status(400).json({ error: '姓名不可超過 30 字' });
  }

  try {
    const wish = await Wish.findByIdAndUpdate(
      req.params.id,
      { name, content },
      { new: true }
    );
    if (!wish) {
      return res.status(404).json({ error: '找不到此心願' });
    }

    const wishObj = {
      _id: wish._id,
      name: wish.name,
      content: wish.content,
      created_at: wish.created_at
    };

    // Broadcast update to display screens
    io.emit('wish-updated', wishObj);

    res.json({ success: true, wish: wishObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a wish (admin only)
app.delete('/api/wishes/:id', requireAdmin, async (req, res) => {
  try {
    const wish = await Wish.findByIdAndDelete(req.params.id);
    if (!wish) {
      return res.status(404).json({ error: '找不到此心願' });
    }

    // Broadcast deletion to display screens
    io.emit('wish-deleted', { _id: wish._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate QR Code (returns data URL)
app.get('/api/qrcode', async (req, res) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;
  const url = `${baseUrl}/submit.html`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#ffffffee', light: '#00000000' }
    });
    res.json({ qr: dataUrl, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Socket.io ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🌟 展示端已連線:', socket.id);
  socket.on('disconnect', () => {
    console.log('💫 展示端已斷線:', socket.id);
  });
});

// ── Start server ─────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://${getLocalIP()}:${PORT}`;
  const displayUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  console.log(`\n✨ 心願牆伺服器已啟動`);
  console.log(`   展示牆: ${displayUrl}`);
  console.log(`   手機端: ${baseUrl}/submit.html`);
  console.log(`   管理後台: ${displayUrl}/admin.html`);
  if (!process.env.RENDER_EXTERNAL_URL) {
    console.log(`   (請確認手機與電腦在同一 Wi-Fi 網路下)`);
  }
  console.log('\n');
});
