import express from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zapchat-super-secret-key-987654321';
const DATA_FILE = path.join(process.cwd(), 'data_store.json');

// Interface Definitions
interface DBUser {
  phoneNumber: string;
  email?: string;
  displayName: string;
  passwordHash: string;
  initial: string;
  avatarColor: string;
}

interface DBMessage {
  id: string;
  senderPhoneNumber?: string;
  senderEmail?: string;
  senderName?: string;
  senderId?: string;
  text: string;
  time: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'document' | 'location' | 'contact' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  contactName?: string;
  contactPhone?: string;
}

interface DBChat {
  id: string;
  name: string;
  avatarColor: string;
  avatarLetter: string;
  isGroup: boolean;
  statusText: string;
  online: boolean;
  messages: DBMessage[];
  unreadCount: number;
  inviteCode?: string;
  createdBy?: string;
  members?: string[];
  description?: string;
  createdAt?: string;
}

interface DBStore {
  users: DBUser[];
  chats: DBChat[];
}

// Default chats to initialize with (empty for real data usage)
const INITIAL_CHATS_SERVER: DBChat[] = [];

// In-Memory state loaded from file
let db: DBStore = {
  users: [],
  chats: INITIAL_CHATS_SERVER
};

// Load data store from JSON file on startup
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      db = {
        users: parsed.users || [],
        chats: parsed.chats || INITIAL_CHATS_SERVER
      };
      console.log('Database loaded successfully from file.');
    } else {
      saveDB();
      console.log('Database initialized and saved.');
    }
  } catch (err) {
    console.error('Failed to load database file, using in-memory fallback', err);
  }
}

// Save database state to JSON file
function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file', err);
  }
}

// Run DB loader
loadDB();

// Express server setup
async function startServer() {
  const app = express();
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS headers for ease of preview in cross-origin situations
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // JWT auth verification middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido ou expirado.' });
      }
      req.user = decoded;
      next();
    });
  };

  // --- AUTH ENDPOINTS ---

  // POST /api/auth/register
  app.post('/api/auth/register', (req, res) => {
    const { phoneNumber, email, password, displayName } = req.body;
    const phoneInput = (phoneNumber || email || '').trim();

    if (!phoneInput || !password) {
      return res.status(400).json({ error: 'Número de telefone e senha são obrigatórios.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
    }

    const cleanPhone = phoneInput;
    const name = displayName?.trim() || cleanPhone;

    // Check if user already exists
    const userExists = db.users.some(u => u.phoneNumber === cleanPhone || (u.email && u.email === cleanPhone));
    if (userExists) {
      return res.status(409).json({ error: 'Este número de telefone já está cadastrado.' });
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);
    const initial = name.charAt(0).toUpperCase() || 'U';

    const colors = [
      '#FF2A2A', '#E02424', '#DC2626', '#EF4444', 
      '#F87171', '#3B82F6', '#6366F1', '#8B5CF6', 
      '#EC4899', '#F97316', '#D97706', '#0284C7'
    ];
    const colorIndex = (initial.charCodeAt(0) || 0) % colors.length;
    const avatarColor = colors[colorIndex];

    const newUser: DBUser = {
      phoneNumber: cleanPhone,
      email: email || `${cleanPhone.replace(/[^0-9]/g, '')}@zapchat.phone`,
      displayName: name,
      passwordHash,
      initial,
      avatarColor
    };

    db.users.push(newUser);
    saveDB();

    // Generate JWT token
    const token = jwt.sign({ phoneNumber: cleanPhone, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        phoneNumber: cleanPhone,
        displayName: name,
        initial,
        avatarColor
      }
    });
  });

  // POST /api/auth/phone-login (phone-verified login / register without password)
  app.post('/api/auth/phone-login', (req, res) => {
    const { phoneNumber, displayName } = req.body;
    const cleanPhone = (phoneNumber || '').trim();

    if (!cleanPhone) {
      return res.status(400).json({ error: 'Número de telefone obrigatório.' });
    }

    let user = db.users.find(u => u.phoneNumber === cleanPhone);
    const resolvedName = displayName?.trim() || cleanPhone;
    const initial = resolvedName.charAt(0).toUpperCase() || 'U';

    if (!user) {
      const colors = [
        '#06B6D4', '#0891B2', '#00E5FF', '#10B981', '#059669',
        '#14B8A6', '#0284C7', '#3B82F6', '#6366F1', '#F59E0B'
      ];
      const colorIndex = (initial.charCodeAt(0) || 0) % colors.length;
      user = {
        phoneNumber: cleanPhone,
        email: `${cleanPhone.replace(/[^0-9]/g, '')}@zapchat.phone`,
        displayName: resolvedName,
        passwordHash: 'PHONE_VERIFIED',
        initial,
        avatarColor: colors[colorIndex]
      };
      db.users.push(user);
      saveDB();
    } else if (displayName && user.displayName !== resolvedName) {
      user.displayName = resolvedName;
      saveDB();
    }

    const token = jwt.sign({ phoneNumber: cleanPhone, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({
      token,
      user: {
        phoneNumber: cleanPhone,
        displayName: user.displayName,
        initial: user.initial,
        avatarColor: user.avatarColor
      }
    });
  });

  // POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    const { phoneNumber, email, password } = req.body;
    const phoneInput = (phoneNumber || email || '').trim();

    if (!phoneInput || !password) {
      return res.status(400).json({ error: 'Número de telefone e senha são obrigatórios.' });
    }

    // Find user by phone number or email
    const user = db.users.find(u => u.phoneNumber === phoneInput || u.email === phoneInput);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu número e senha.' });
    }

    // Verify password hash
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu número e senha.' });
    }

    // Generate JWT token
    const token = jwt.sign({ phoneNumber: user.phoneNumber, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        phoneNumber: user.phoneNumber,
        displayName: user.displayName || user.phoneNumber,
        initial: user.initial,
        avatarColor: user.avatarColor
      }
    });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user = db.users.find(u => 
      (req.user.phoneNumber && u.phoneNumber === req.user.phoneNumber) || 
      (req.user.email && u.email === req.user.email)
    );
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.status(200).json({
      user: {
        phoneNumber: user.phoneNumber,
        displayName: user.displayName || user.phoneNumber,
        initial: user.initial,
        avatarColor: user.avatarColor
      }
    });
  });

  // GET /api/users/check (validate if an E.164 phone number belongs to a registered app user)
  app.get('/api/users/check', (req, res) => {
    const rawPhone = String(req.query.phone || '');
    const digitsOnly = rawPhone.replace(/[\s().+-]/g, '').replace(/\D/g, '');
    const e164Phone = digitsOnly ? `+${digitsOnly}` : '';

    if (!e164Phone || e164Phone.length < 8 || e164Phone.length > 16) {
      return res.status(200).json({ exists: false });
    }

    const foundUser = db.users.find((u) => {
      const uDigits = (u.phoneNumber || '').replace(/[\s().+-]/g, '').replace(/\D/g, '');
      const uE164 = uDigits ? `+${uDigits}` : '';
      if (!uE164 || uE164.length < 8 || uE164.length > 16) return false;
      if (uE164 === e164Phone) return true;
      return uDigits.endsWith(digitsOnly) || digitsOnly.endsWith(uDigits);
    });

    if (foundUser) {
      return res.status(200).json({
        exists: true,
        user: {
          phoneNumber: foundUser.phoneNumber,
          displayName: foundUser.displayName || foundUser.phoneNumber,
          initial: foundUser.initial,
          avatarColor: foundUser.avatarColor
        }
      });
    }

    return res.status(200).json({ exists: false });
  });

  // --- CHAT ENDPOINTS ---

  // POST /api/chats (create a new chat)
  app.post('/api/chats', (req: any, res) => {
    const { name, isGroup, userEmail, senderPhoneNumber, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'O nome da conversa é obrigatório.' });
    }

    const colors = ['#FF2A2A', '#E02424', '#DC2626', '#EF4444', '#3B82F6', '#8B5CF6'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    
    const words = name.trim().split(' ');
    const avatarLetter = words.map((w: string) => w.charAt(0).toUpperCase()).slice(0, 2).join('');

    const creator = senderPhoneNumber || userEmail || (req.user && (req.user.phoneNumber || req.user.email)) || '+5511999999999';
    const inviteCode = isGroup ? 'zap-' + Math.random().toString(36).substring(2, 8) : undefined;

    const newChat: DBChat = {
      id: 'chat-' + Date.now(),
      name: name.trim(),
      avatarColor,
      avatarLetter,
      isGroup: !!isGroup,
      statusText: isGroup ? '1 participante' : 'online',
      online: !isGroup,
      unreadCount: 0,
      inviteCode,
      createdBy: creator,
      members: isGroup ? [creator] : undefined,
      description: description || (isGroup ? 'Grupo criado no ZapChat' : undefined),
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 'welcome-' + Date.now(),
          senderPhoneNumber: '+5500000000000',
          senderName: 'Sistema',
          text: isGroup 
            ? `Você criou o grupo "${name}". Compartilhe o link de convite com seus contatos para que entrem!` 
            : `Nova conversa iniciada com ${name}. Envie uma mensagem!`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          status: 'read'
        }
      ]
    };

    db.chats.unshift(newChat);
    saveDB();

    res.status(201).json(newChat);
  });

  // GET /api/invites/:inviteCode (fetch group preview by invite code)
  app.get('/api/invites/:inviteCode', (req, res) => {
    const { inviteCode } = req.params;
    const chat = db.chats.find(c => c.isGroup && c.inviteCode === inviteCode);

    if (!chat) {
      return res.status(404).json({ error: 'Link de convite inválido ou expirado.' });
    }

    res.status(200).json({
      id: chat.id,
      name: chat.name,
      avatarColor: chat.avatarColor,
      avatarLetter: chat.avatarLetter,
      description: chat.description || 'Grupo no ZapChat Web',
      memberCount: chat.members ? chat.members.length : 1,
      createdAt: chat.createdAt,
      createdBy: chat.createdBy
    });
  });

  // POST /api/invites/:inviteCode/join (join group via invite code)
  app.post('/api/invites/:inviteCode/join', (req: any, res) => {
    const { inviteCode } = req.params;
    const { userEmail, senderPhoneNumber } = req.body;

    const chat = db.chats.find(c => c.isGroup && c.inviteCode === inviteCode);
    if (!chat) {
      return res.status(404).json({ error: 'Link de convite inválido ou expirado.' });
    }

    const phone = senderPhoneNumber || (userEmail && userEmail.startsWith('+') ? userEmail : null) || (req.user && (req.user.phoneNumber || req.user.email)) || '+5511999999999';
    const userName = phone.startsWith('+') ? phone : (userEmail || phone).split('@')[0];

    if (!chat.members) {
      chat.members = [];
    }

    const alreadyMember = chat.members.includes(phone);
    if (!alreadyMember) {
      chat.members.push(phone);

      const joinMessage: DBMessage = {
        id: 'join-' + Date.now(),
        senderPhoneNumber: '+5511999999999',
        senderName: 'Sistema',
        text: `🎉 ${userName} entrou no grupo usando o link de convite.`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        status: 'read'
      };

      chat.messages.push(joinMessage);
      chat.statusText = `${chat.members.length} participantes`;
      saveDB();
    }

    res.status(200).json(chat);
  });

  // POST /api/chats/:chatId/revoke-invite (generate new invite code)
  app.post('/api/chats/:chatId/revoke-invite', (req: any, res) => {
    const { chatId } = req.params;
    const chat = db.chats.find(c => c.id === chatId);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    chat.inviteCode = 'zap-' + Math.random().toString(36).substring(2, 8);
    saveDB();

    res.status(200).json({ 
      inviteCode: chat.inviteCode,
      message: 'Novo link de convite gerado com sucesso.' 
    });
  });

  // POST /api/chats/:chatId/messages (send a message)
  app.post('/api/chats/:chatId/messages', (req: any, res) => {
    const { chatId } = req.params;
    const { id, text, senderPhoneNumber, userEmail, senderName: nameInput, senderId, type, mediaUrl, fileName, fileSize, contactName, contactPhone } = req.body;

    if (!text && !mediaUrl && !contactPhone) {
      return res.status(400).json({ error: 'O texto ou arquivo da mensagem é obrigatório.' });
    }

    const chat = db.chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    const messageId = id || ('msg-' + Date.now());

    // Prevent duplicate insert if already present
    const existingMsg = chat.messages.find(m => m.id === messageId);
    if (existingMsg) {
      return res.status(200).json(existingMsg);
    }

    const phone = senderPhoneNumber || userEmail || (req.user && (req.user.phoneNumber || req.user.email)) || '+5511999999999';
    const senderName = nameInput || phone.split('@')[0];

    const newMessage: DBMessage = {
      id: messageId,
      senderPhoneNumber: phone,
      senderEmail: userEmail || undefined,
      senderName,
      senderId,
      text: text || (fileName ? `[Arquivo: ${fileName}]` : ''),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: 'sent',
      type: type || 'text',
      mediaUrl,
      fileName,
      fileSize,
      contactName,
      contactPhone
    };

    chat.messages.push(newMessage);
    saveDB();

    res.status(201).json(newMessage);
  });

  // DELETE /api/chats/:chatId/messages/:messageId (delete a message)
  app.delete('/api/chats/:chatId/messages/:messageId', (req: any, res) => {
    const { chatId, messageId } = req.params;
    const chat = db.chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    const initialLen = chat.messages.length;
    chat.messages = chat.messages.filter(m => m.id !== messageId);
    if (chat.messages.length !== initialLen) {
      saveDB();
    }

    res.status(200).json({ success: true, deletedId: messageId });
  });

  // GET /api/chats (returns all chats)
  app.get('/api/chats', (req, res) => {
    res.status(200).json(db.chats);
  });

  // GET /api/sync (polling sync endpoint across clients)
  app.get('/api/sync', (req, res) => {
    const since = parseInt(req.query.since as string) || 0;

    // Extract all messages created since `since` across all chats
    const newMessages: (DBMessage & { chatId: string })[] = [];
    
    db.chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.timestamp > since) {
          newMessages.push({
            ...msg,
            chatId: chat.id
          });
        }
      });
    });

    res.status(200).json({
      messages: newMessages,
      chats: db.chats, // send all chats to ensure any newly added conversations or statuses are synced
      timestamp: Date.now()
    });
  });

  // POST /api/branding/upload-logo (upload official original logo 100% unaltered)
  app.post('/api/branding/upload-logo', (req, res) => {
    try {
      const { imageData } = req.body;
      if (!imageData) {
        return res.status(400).json({ error: 'Nenhum dado de imagem fornecido.' });
      }

      // Extract base64 buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const publicDir = path.join(process.cwd(), 'public');
      const distDir = path.join(process.cwd(), 'dist');
      const iconsDir = path.join(publicDir, 'icons');
      const distIconsDir = path.join(distDir, 'icons');

      if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
      if (!fs.existsSync(distIconsDir)) fs.mkdirSync(distIconsDir, { recursive: true });

      // Save 100% untouched original file verbatim
      fs.writeFileSync(path.join(publicDir, 'tribbus-logo.png'), buffer);
      fs.writeFileSync(path.join(publicDir, 'tribbus-splash-logo.png'), buffer);
      fs.writeFileSync(path.join(publicDir, '18051034-ac80-4510-9741-f29b5bda1533.png'), buffer);

      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'tribbus-logo.png'), buffer);
        fs.writeFileSync(path.join(distDir, 'tribbus-splash-logo.png'), buffer);
        fs.writeFileSync(path.join(distDir, '18051034-ac80-4510-9741-f29b5bda1533.png'), buffer);
      }

      // Generate exact square icons without altering design features
      try {
        const tempPath = path.join('/tmp', 'official_raw_logo.png');
        fs.writeFileSync(tempPath, buffer);
        const { execSync } = require('child_process');
        execSync(`convert "${tempPath}" -background "#020617" -gravity center -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" -resize 512x512 "${path.join(iconsDir, 'icon-512x512.png')}"`);
        execSync(`convert "${path.join(iconsDir, 'icon-512x512.png')}" -resize 192x192 "${path.join(iconsDir, 'icon-192x192.png')}"`);
        fs.copyFileSync(path.join(iconsDir, 'icon-512x512.png'), path.join(publicDir, 'pwa-icon.png'));
        fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.join(publicDir, 'apple-touch-icon.png'));
        fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.join(publicDir, 'favicon.png'));

        if (fs.existsSync(distIconsDir)) {
          fs.copyFileSync(path.join(iconsDir, 'icon-512x512.png'), path.join(distIconsDir, 'icon-512x512.png'));
          fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.join(distIconsDir, 'icon-192x192.png'));
          fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.join(distDir, 'favicon.png'));
          fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.join(distDir, 'apple-touch-icon.png'));
          fs.copyFileSync(path.join(iconsDir, 'icon-512x512.png'), path.join(distDir, 'pwa-icon.png'));
        }
      } catch (magickErr) {
        console.warn('ImageMagick icon resizing fallback:', magickErr);
        fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), buffer);
        fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), buffer);
      }

      return res.json({ success: true, message: 'Logotipo oficial atualizado com sucesso e 100% inalterado!' });
    } catch (err: any) {
      console.error('Erro ao salvar logotipo oficial:', err);
      return res.status(500).json({ error: 'Falha ao salvar o logotipo: ' + (err.message || 'Erro interno') });
    }
  });

  // Lazy initialization for Gemini AI client
  let genAIClient: GoogleGenAI | null = null;
  function getGenAI(): GoogleGenAI {
    if (!genAIClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      genAIClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return genAIClient;
  }

  // POST /api/ai/chat (Process message with Gemini API via @google/genai)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history, senderPhoneNumber } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Mensagem é obrigatória.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          reply: `Olá! Sou o Tribbu AI. Recebi sua mensagem: "${message}". Configure a variável GEMINI_API_KEY para habilitar todas as respostas completas em tempo real.`
        });
      }

      const ai = getGenAI();

      // Format conversation history for Gemini API
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-10);
        for (const h of recent) {
          const role = h.role === 'user' ? 'user' : 'model';
          const text = h.content || h.text || '';
          if (text) {
            contents.push({
              role,
              parts: [{ text }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: 'Você é o Tribbu AI, a inteligência artificial nativa do Tribbu\'sChat ("A voz da sua Tribbu"). Seja prestativo, rápido, inteligente, simpático e converse em português do Brasil com respostas bem estruturadas, claras e naturais. Você auxilia os membros da sua Tribbu com respostas a qualquer dúvida, ideias, resumos, auxílio técnico e informações sobre os recursos do Tribbu\'sChat (como canais, grupos, envio de mídias com fotos e vídeos em alta resolução, avisos de 24h e segurança em tempo real).',
        }
      });

      const replyText = response.text || 'Olá! Como posso te ajudar hoje?';
      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error('Error generating AI response with @google/genai:', err);
      return res.status(500).json({
        reply: 'Desculpe, tive uma instabilidade momentânea ao processar sua solicitação no Tribbu AI. Por favor, tente novamente.',
        error: err.message || 'Erro interno'
      });
    }
  });

  // Vite development middleware vs Static serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZapChat Backend] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
