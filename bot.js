require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const app = express();
const bot = new TelegramBot(token);

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${token}`;

bot.setWebHook(`${DOMAIN}${WEBHOOK_PATH}`);

// ===== DATA =====
const requestedUsers = new Set(); // Private kanalga kirganlar

// ===== CHANNELS =====
const PUBLIC_CHANNEL = "@sheraliyevich_web";

const PRIVATE_LINKS = [
  { name: "1K", link: "https://t.me/+hxFSNywQS8w3Yjc6", chat_id:  -1003531748359 },
  { name: "2K", link: "https://t.me/+CAohVwhcnnE2NmI6", chat_id:  -1003830402105 },
  { name: "3K", link: "https://t.me/+lqbcrISkeSBiMzNi", chat_id: -1003859050749 }
];

// ===== PRIVATE JOIN =====
bot.on('chat_join_request', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    await bot.approveChatJoinRequest(chatId, userId);

    setTimeout(async () => {
      const member = await bot.getChatMember(chatId, userId);
      if (member.status === 'member') {
        requestedUsers.add(`${userId}_${chatId}`);
      }
    }, 1500);

  } catch {}
});

// ===== CHECK FUNCTION =====
async function check(userId) {
  // PRIVATE: har bir kanalni tekshirish
  for (const ch of PRIVATE_LINKS) {
    if (!requestedUsers.has(`${userId}_${ch.chat_id}`)) return false;
  }

  // PUBLIC
  try {
    const m = await bot.getChatMember(PUBLIC_CHANNEL, userId);
    if (!['member','administrator','creator'].includes(m.status)) return false;
  } catch {
    return false;
  }

  return true;
}

// ===== KEYBOARD =====
function keyboard() {
  const buttons = [
    [{ text: "📢 Public kanal", url: `https://t.me/${PUBLIC_CHANNEL.replace('@','')}` }]
  ];

  for (const ch of PRIVATE_LINKS) {
    buttons.push([{ text: `🔗 ${ch.name}`, url: ch.link }]);
  }

  buttons.push([{ text: "✅ Tekshirish", callback_data: "check" }]);

  return { inline_keyboard: buttons };
}

// ===== EXPRESS =====
app.use(express.json());

app.post(WEBHOOK_PATH, (req,res)=>{
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, ()=>console.log(`Server ishlayapti ${PORT}`));

// ===== START =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId,
    "📢 Botdan foydalanish uchun barcha kanallarga obuna bo‘ling",
    { reply_markup: keyboard() }
  );
});

// ===== BUTTON =====
bot.on('callback_query', async (q) => {
  const id = q.from.id;
  const chatId = q.message.chat.id;

  const ok = await check(id);

  if (ok) {
    bot.sendMessage(chatId, "✅ Hammasiga obuna bo‘ldingiz! Endi foydalanishingiz mumkin.");
  } else {
    bot.sendMessage(chatId,
      "❌ Hali barcha kanallarga obuna bo‘lmadingiz",
      { reply_markup: keyboard() }
    );
  }

  bot.answerCallbackQuery(q.id);
});

// ===== MESSAGE =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.text || msg.text.startsWith('/')) return;

  const ok = await check(userId);

  if (!ok) {
    return bot.sendMessage(chatId,
      "🚫 Avval barcha kanallarga obuna bo‘ling!",
      { reply_markup: keyboard() }
    );
  }

  bot.sendMessage(chatId, "✅ Ruxsat bor!");
});

// ===== ADMIN =====
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
    `👤 Private join: ${requestedUsers.size}`
  );
});