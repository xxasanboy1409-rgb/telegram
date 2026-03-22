require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const app = express();
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(token);
const WEBHOOK_PATH = `/bot${token}`;
bot.setWebHook(`${DOMAIN}${WEBHOOK_PATH}`);

// ===== DATABASE (oddiy) =====
const users = new Map();
const blockedUsers = new Set();
const requestedUsers = new Set();

// ===== SETTINGS =====
const REF_REQUIRED = 2;

// ===== CHANNELS =====
const channels = [
  { name: "CHANEL", username: "@sheraliyevich_web" }
];

const joinLinks = [
  { name: "PRIVATE", link: "https://t.me/+hxFSNywQS8w3Yjc6" }
];

// ===== FILES =====
const files = {
  '1': { type: 'document', file: 'Portfolio.zip', caption: "📁 Portfolio" }
};

// ===== FILE CHECK =====
function getFilePath(fileName) {
  const filePath = path.join(__dirname, fileName);
  return fs.existsSync(filePath) ? filePath : null;
}

// ===== REFERAL =====
function addUser(userId, referrer) {
  if (!users.has(userId)) {
    users.set(userId, { ref: referrer || null, invites: 0 });

    if (referrer && users.has(referrer)) {
      users.get(referrer).invites++;
    }
  }
}

// ===== JOIN REQUEST =====
bot.on('chat_join_request', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    await bot.approveChatJoinRequest(chatId, userId);

    setTimeout(async () => {
      const member = await bot.getChatMember(chatId, userId);
      if (member.status === 'member') {
        requestedUsers.add(userId);
      }
    }, 2000);

  } catch (e) {
    console.log(e.message);
  }
});

// ===== CHECK =====
async function checkSubscription(userId) {

  if (blockedUsers.has(userId)) return false;

  // PRIVATE
  if (!requestedUsers.has(userId)) {
    blockedUsers.add(userId);
    return false;
  }

  // PUBLIC
  try {
    for (const ch of channels) {
      const member = await bot.getChatMember(ch.username, userId);

      if (!['member','administrator','creator'].includes(member.status)) {
        blockedUsers.add(userId);
        return false;
      }
    }
  } catch {
    return false;
  }

  // REFERAL
  const user = users.get(userId);
  if (!user || user.invites < REF_REQUIRED) return false;

  return true;
}

// ===== KEYBOARD =====
function getKeyboard(userId) {
  const refLink = `https://t.me/YOUR_BOT?start=${userId}`;

  return {
    inline_keyboard: [
      ...channels.map(ch => [
        { text: `📢 ${ch.name}`, url: `https://t.me/${ch.username.replace('@','')}` }
      ]),
      ...joinLinks.map(ch => [
        { text: `🔗 PRIVATE`, url: ch.link }
      ]),
      [{ text: "👥 Do‘st taklif qilish", url: refLink }],
      [{ text: "✅ Tekshirish", callback_data: 'check' }]
    ]
  };
}

// ===== EXPRESS =====
app.use(express.json());

app.post(WEBHOOK_PATH, (req,res)=>{
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, ()=>console.log("Server ishlayapti"));

// ===== START =====
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const ref = match[1] ? Number(match[1]) : null;

  addUser(userId, ref);

  const user = users.get(userId);

  if (!user || user.invites < REF_REQUIRED) {
    return bot.sendMessage(chatId,
      `🚀 Botdan foydalanish uchun:\n\n👥 ${REF_REQUIRED} ta odam taklif qiling\n\nSiz: ${user.invites}/${REF_REQUIRED}`,
      { reply_markup: getKeyboard(userId) }
    );
  }

  const ok = await checkSubscription(userId);

  if (!ok) {
    return bot.sendMessage(chatId,
      "📢 Kanallarga obuna bo‘ling:",
      { reply_markup: getKeyboard(userId) }
    );
  }

  bot.sendMessage(chatId, "🔓 Ochildi! Raqam yuboring");
});

// ===== BUTTON =====
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  const ok = await checkSubscription(userId);

  if (ok) {
    bot.sendMessage(chatId, "✅ Tasdiqlandi!");
  } else {
    const user = users.get(userId);
    bot.sendMessage(chatId,
      `❌ Hali to‘liq emas\n👥 Referal: ${user?.invites || 0}/${REF_REQUIRED}`,
      { reply_markup: getKeyboard(userId) }
    );
  }

  bot.answerCallbackQuery(q.id);
});

// ===== MESSAGE =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const ok = await checkSubscription(userId);

  if (!ok) {
    return bot.sendMessage(chatId,
      "🚫 Ruxsat yo‘q!",
      { reply_markup: getKeyboard(userId) }
    );
  }

  const data = files[text];
  if (!data) return bot.sendMessage(chatId, "❌ Noto‘g‘ri");

  const filePath = getFilePath(data.file);
  if (!filePath) return bot.sendMessage(chatId, "⚠️ Fayl yo‘q");

  if (data.type === 'document') {
    bot.sendDocument(chatId, filePath, { caption: data.caption });
  }
});

// ===== ADMIN =====
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
    `📊 Statistika:\n\n👤 Users: ${users.size}\n🚫 Block: ${blockedUsers.size}`
  );
});