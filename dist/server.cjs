var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var PORT = 3e3;
var JWT_SECRET = process.env.JWT_SECRET || "zapchat-super-secret-key-987654321";
var DATA_FILE = import_path.default.join(process.cwd(), "data_store.json");
var INITIAL_CHATS_SERVER = [];
var db = {
  users: [],
  chats: INITIAL_CHATS_SERVER
};
function loadDB() {
  try {
    if (import_fs.default.existsSync(DATA_FILE)) {
      const data = import_fs.default.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      db = {
        users: parsed.users || [],
        chats: parsed.chats || INITIAL_CHATS_SERVER
      };
      console.log("Database loaded successfully from file.");
    } else {
      saveDB();
      console.log("Database initialized and saved.");
    }
  } catch (err) {
    console.error("Failed to load database file, using in-memory fallback", err);
  }
}
function saveDB() {
  try {
    import_fs.default.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save database file", err);
  }
}
loadDB();
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token de autentica\xE7\xE3o ausente." });
    }
    import_jsonwebtoken.default.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: "Token inv\xE1lido ou expirado." });
      }
      req.user = decoded;
      next();
    });
  };
  app.post("/api/auth/register", (req, res) => {
    const { phoneNumber, email, password, displayName } = req.body;
    const phoneInput = (phoneNumber || email || "").trim();
    if (!phoneInput || !password) {
      return res.status(400).json({ error: "N\xFAmero de telefone e senha s\xE3o obrigat\xF3rios." });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 4 caracteres." });
    }
    const cleanPhone = phoneInput;
    const name = displayName?.trim() || cleanPhone;
    const userExists = db.users.some((u) => u.phoneNumber === cleanPhone || u.email && u.email === cleanPhone);
    if (userExists) {
      return res.status(409).json({ error: "Este n\xFAmero de telefone j\xE1 est\xE1 cadastrado." });
    }
    const passwordHash = import_bcryptjs.default.hashSync(password, 10);
    const initial = name.charAt(0).toUpperCase() || "U";
    const colors = [
      "#FF2A2A",
      "#E02424",
      "#DC2626",
      "#EF4444",
      "#F87171",
      "#3B82F6",
      "#6366F1",
      "#8B5CF6",
      "#EC4899",
      "#F97316",
      "#D97706",
      "#0284C7"
    ];
    const colorIndex = (initial.charCodeAt(0) || 0) % colors.length;
    const avatarColor = colors[colorIndex];
    const newUser = {
      phoneNumber: cleanPhone,
      email: email || `${cleanPhone.replace(/[^0-9]/g, "")}@zapchat.phone`,
      displayName: name,
      passwordHash,
      initial,
      avatarColor
    };
    db.users.push(newUser);
    saveDB();
    const token = import_jsonwebtoken.default.sign({ phoneNumber: cleanPhone, email: newUser.email }, JWT_SECRET, { expiresIn: "7d" });
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
  app.post("/api/auth/phone-login", (req, res) => {
    const { phoneNumber, displayName } = req.body;
    const cleanPhone = (phoneNumber || "").trim();
    if (!cleanPhone) {
      return res.status(400).json({ error: "N\xFAmero de telefone obrigat\xF3rio." });
    }
    let user = db.users.find((u) => u.phoneNumber === cleanPhone);
    const resolvedName = displayName?.trim() || cleanPhone;
    const initial = resolvedName.charAt(0).toUpperCase() || "U";
    if (!user) {
      const colors = [
        "#06B6D4",
        "#0891B2",
        "#00E5FF",
        "#10B981",
        "#059669",
        "#14B8A6",
        "#0284C7",
        "#3B82F6",
        "#6366F1",
        "#F59E0B"
      ];
      const colorIndex = (initial.charCodeAt(0) || 0) % colors.length;
      user = {
        phoneNumber: cleanPhone,
        email: `${cleanPhone.replace(/[^0-9]/g, "")}@zapchat.phone`,
        displayName: resolvedName,
        passwordHash: "PHONE_VERIFIED",
        initial,
        avatarColor: colors[colorIndex]
      };
      db.users.push(user);
      saveDB();
    } else if (displayName && user.displayName !== resolvedName) {
      user.displayName = resolvedName;
      saveDB();
    }
    const token = import_jsonwebtoken.default.sign({ phoneNumber: cleanPhone, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
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
  app.post("/api/auth/login", (req, res) => {
    const { phoneNumber, email, password } = req.body;
    const phoneInput = (phoneNumber || email || "").trim();
    if (!phoneInput || !password) {
      return res.status(400).json({ error: "N\xFAmero de telefone e senha s\xE3o obrigat\xF3rios." });
    }
    const user = db.users.find((u) => u.phoneNumber === phoneInput || u.email === phoneInput);
    if (!user) {
      return res.status(401).json({ error: "Credenciais inv\xE1lidas. Verifique seu n\xFAmero e senha." });
    }
    const isPasswordValid = import_bcryptjs.default.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Credenciais inv\xE1lidas. Verifique seu n\xFAmero e senha." });
    }
    const token = import_jsonwebtoken.default.sign({ phoneNumber: user.phoneNumber, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
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
  app.get("/api/auth/me", authenticateToken, (req, res) => {
    const user = db.users.find(
      (u) => req.user.phoneNumber && u.phoneNumber === req.user.phoneNumber || req.user.email && u.email === req.user.email
    );
    if (!user) {
      return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
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
  app.post("/api/chats", (req, res) => {
    const { name, isGroup, userEmail, senderPhoneNumber, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "O nome da conversa \xE9 obrigat\xF3rio." });
    }
    const colors = ["#FF2A2A", "#E02424", "#DC2626", "#EF4444", "#3B82F6", "#8B5CF6"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    const words = name.trim().split(" ");
    const avatarLetter = words.map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
    const creator = senderPhoneNumber || userEmail || req.user && (req.user.phoneNumber || req.user.email) || "+5511999999999";
    const inviteCode = isGroup ? "zap-" + Math.random().toString(36).substring(2, 8) : void 0;
    const newChat = {
      id: "chat-" + Date.now(),
      name: name.trim(),
      avatarColor,
      avatarLetter,
      isGroup: !!isGroup,
      statusText: isGroup ? "1 participante" : "online",
      online: !isGroup,
      unreadCount: 0,
      inviteCode,
      createdBy: creator,
      members: isGroup ? [creator] : void 0,
      description: description || (isGroup ? "Grupo criado no ZapChat" : void 0),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      messages: [
        {
          id: "welcome-" + Date.now(),
          senderPhoneNumber: "+5500000000000",
          senderName: "Sistema",
          text: isGroup ? `Voc\xEA criou o grupo "${name}". Compartilhe o link de convite com seus contatos para que entrem!` : `Nova conversa iniciada com ${name}. Envie uma mensagem!`,
          time: (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
          status: "read"
        }
      ]
    };
    db.chats.unshift(newChat);
    saveDB();
    res.status(201).json(newChat);
  });
  app.get("/api/invites/:inviteCode", (req, res) => {
    const { inviteCode } = req.params;
    const chat = db.chats.find((c) => c.isGroup && c.inviteCode === inviteCode);
    if (!chat) {
      return res.status(404).json({ error: "Link de convite inv\xE1lido ou expirado." });
    }
    res.status(200).json({
      id: chat.id,
      name: chat.name,
      avatarColor: chat.avatarColor,
      avatarLetter: chat.avatarLetter,
      description: chat.description || "Grupo no ZapChat Web",
      memberCount: chat.members ? chat.members.length : 1,
      createdAt: chat.createdAt,
      createdBy: chat.createdBy
    });
  });
  app.post("/api/invites/:inviteCode/join", (req, res) => {
    const { inviteCode } = req.params;
    const { userEmail, senderPhoneNumber } = req.body;
    const chat = db.chats.find((c) => c.isGroup && c.inviteCode === inviteCode);
    if (!chat) {
      return res.status(404).json({ error: "Link de convite inv\xE1lido ou expirado." });
    }
    const phone = senderPhoneNumber || (userEmail && userEmail.startsWith("+") ? userEmail : null) || req.user && (req.user.phoneNumber || req.user.email) || "+5511999999999";
    const userName = phone.startsWith("+") ? phone : (userEmail || phone).split("@")[0];
    if (!chat.members) {
      chat.members = [];
    }
    const alreadyMember = chat.members.includes(phone);
    if (!alreadyMember) {
      chat.members.push(phone);
      const joinMessage = {
        id: "join-" + Date.now(),
        senderPhoneNumber: "+5511999999999",
        senderName: "Sistema",
        text: `\u{1F389} ${userName} entrou no grupo usando o link de convite.`,
        time: (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        status: "read"
      };
      chat.messages.push(joinMessage);
      chat.statusText = `${chat.members.length} participantes`;
      saveDB();
    }
    res.status(200).json(chat);
  });
  app.post("/api/chats/:chatId/revoke-invite", (req, res) => {
    const { chatId } = req.params;
    const chat = db.chats.find((c) => c.id === chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Grupo n\xE3o encontrado." });
    }
    chat.inviteCode = "zap-" + Math.random().toString(36).substring(2, 8);
    saveDB();
    res.status(200).json({
      inviteCode: chat.inviteCode,
      message: "Novo link de convite gerado com sucesso."
    });
  });
  app.post("/api/chats/:chatId/messages", (req, res) => {
    const { chatId } = req.params;
    const { id, text, senderPhoneNumber, userEmail, senderName: nameInput, senderId, type, mediaUrl, fileName, fileSize, contactName, contactPhone } = req.body;
    if (!text && !mediaUrl && !contactPhone) {
      return res.status(400).json({ error: "O texto ou arquivo da mensagem \xE9 obrigat\xF3rio." });
    }
    const chat = db.chats.find((c) => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: "Conversa n\xE3o encontrada." });
    }
    const messageId = id || "msg-" + Date.now();
    const existingMsg = chat.messages.find((m) => m.id === messageId);
    if (existingMsg) {
      return res.status(200).json(existingMsg);
    }
    const phone = senderPhoneNumber || userEmail || req.user && (req.user.phoneNumber || req.user.email) || "+5511999999999";
    const senderName = nameInput || phone.split("@")[0];
    const newMessage = {
      id: messageId,
      senderPhoneNumber: phone,
      senderEmail: userEmail || void 0,
      senderName,
      senderId,
      text: text || (fileName ? `[Arquivo: ${fileName}]` : ""),
      time: (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now(),
      status: "sent",
      type: type || "text",
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
  app.get("/api/chats", (req, res) => {
    res.status(200).json(db.chats);
  });
  app.get("/api/sync", (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const newMessages = [];
    db.chats.forEach((chat) => {
      chat.messages.forEach((msg) => {
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
      chats: db.chats,
      // send all chats to ensure any newly added conversations or statuses are synced
      timestamp: Date.now()
    });
  });
  app.post("/api/branding/upload-logo", (req, res) => {
    try {
      const { imageData } = req.body;
      if (!imageData) {
        return res.status(400).json({ error: "Nenhum dado de imagem fornecido." });
      }
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const publicDir = import_path.default.join(process.cwd(), "public");
      const distDir = import_path.default.join(process.cwd(), "dist");
      const iconsDir = import_path.default.join(publicDir, "icons");
      const distIconsDir = import_path.default.join(distDir, "icons");
      if (!import_fs.default.existsSync(iconsDir)) import_fs.default.mkdirSync(iconsDir, { recursive: true });
      if (!import_fs.default.existsSync(distIconsDir)) import_fs.default.mkdirSync(distIconsDir, { recursive: true });
      import_fs.default.writeFileSync(import_path.default.join(publicDir, "tribbus-logo.png"), buffer);
      import_fs.default.writeFileSync(import_path.default.join(publicDir, "tribbus-splash-logo.png"), buffer);
      import_fs.default.writeFileSync(import_path.default.join(publicDir, "18051034-ac80-4510-9741-f29b5bda1533.png"), buffer);
      if (import_fs.default.existsSync(distDir)) {
        import_fs.default.writeFileSync(import_path.default.join(distDir, "tribbus-logo.png"), buffer);
        import_fs.default.writeFileSync(import_path.default.join(distDir, "tribbus-splash-logo.png"), buffer);
        import_fs.default.writeFileSync(import_path.default.join(distDir, "18051034-ac80-4510-9741-f29b5bda1533.png"), buffer);
      }
      try {
        const tempPath = import_path.default.join("/tmp", "official_raw_logo.png");
        import_fs.default.writeFileSync(tempPath, buffer);
        const { execSync } = require("child_process");
        execSync(`convert "${tempPath}" -background "#020617" -gravity center -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" -resize 512x512 "${import_path.default.join(iconsDir, "icon-512x512.png")}"`);
        execSync(`convert "${import_path.default.join(iconsDir, "icon-512x512.png")}" -resize 192x192 "${import_path.default.join(iconsDir, "icon-192x192.png")}"`);
        import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-512x512.png"), import_path.default.join(publicDir, "pwa-icon.png"));
        import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), import_path.default.join(publicDir, "apple-touch-icon.png"));
        import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), import_path.default.join(publicDir, "favicon.png"));
        if (import_fs.default.existsSync(distIconsDir)) {
          import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-512x512.png"), import_path.default.join(distIconsDir, "icon-512x512.png"));
          import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), import_path.default.join(distIconsDir, "icon-192x192.png"));
          import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), import_path.default.join(distDir, "favicon.png"));
          import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), import_path.default.join(distDir, "apple-touch-icon.png"));
          import_fs.default.copyFileSync(import_path.default.join(iconsDir, "icon-512x512.png"), import_path.default.join(distDir, "pwa-icon.png"));
        }
      } catch (magickErr) {
        console.warn("ImageMagick icon resizing fallback:", magickErr);
        import_fs.default.writeFileSync(import_path.default.join(iconsDir, "icon-512x512.png"), buffer);
        import_fs.default.writeFileSync(import_path.default.join(iconsDir, "icon-192x192.png"), buffer);
      }
      return res.json({ success: true, message: "Logotipo oficial atualizado com sucesso e 100% inalterado!" });
    } catch (err) {
      console.error("Erro ao salvar logotipo oficial:", err);
      return res.status(500).json({ error: "Falha ao salvar o logotipo: " + (err.message || "Erro interno") });
    }
  });
  let genAIClient = null;
  function getGenAI() {
    if (!genAIClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      genAIClient = new import_genai.GoogleGenAI({ apiKey });
    }
    return genAIClient;
  }
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, senderPhoneNumber } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem \xE9 obrigat\xF3ria." });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          reply: `Ol\xE1! Sou o Tribbu AI. Recebi sua mensagem: "${message}". Configure a vari\xE1vel GEMINI_API_KEY para habilitar todas as respostas completas em tempo real.`
        });
      }
      const ai = getGenAI();
      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-10);
        for (const h of recent) {
          const role = h.role === "user" ? "user" : "model";
          const text = h.content || h.text || "";
          if (text) {
            contents.push({
              role,
              parts: [{ text }]
            });
          }
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: `Voc\xEA \xE9 o Tribbu AI, a intelig\xEAncia artificial nativa do Tribbu'sChat ("A voz da sua Tribbu"). Seja prestativo, r\xE1pido, inteligente, simp\xE1tico e converse em portugu\xEAs do Brasil com respostas bem estruturadas, claras e naturais. Voc\xEA auxilia os membros da sua Tribbu com respostas a qualquer d\xFAvida, ideias, resumos, aux\xEDlio t\xE9cnico e informa\xE7\xF5es sobre os recursos do Tribbu'sChat (como canais, grupos, envio de m\xEDdias com fotos e v\xEDdeos em alta resolu\xE7\xE3o, avisos de 24h e seguran\xE7a em tempo real).`
        }
      });
      const replyText = response.text || "Ol\xE1! Como posso te ajudar hoje?";
      return res.json({ reply: replyText });
    } catch (err) {
      console.error("Error generating AI response with @google/genai:", err);
      return res.status(500).json({
        reply: "Desculpe, tive uma instabilidade moment\xE2nea ao processar sua solicita\xE7\xE3o no Tribbu AI. Por favor, tente novamente.",
        error: err.message || "Erro interno"
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ZapChat Backend] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
