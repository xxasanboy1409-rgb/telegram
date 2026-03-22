require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;

if (!token || !DOMAIN) {
  throw new Error("TOKEN yoki DOMAIN .env da yo‘q!");
}

const app = express();
const PORT = process.env.PORT || 3000;

// Webhook
const WEBHOOK_PATH = `/bot${token}`;
const bot = new TelegramBot(token);
bot.setWebHook(`${DOMAIN}${WEBHOOK_PATH}`);

// CACHE
const userCache = new Map();

// 🔥 PRIVATE kanalga zayavka yuborganlar
const requestedUsers = new Set();

// 🔥 PRIVATE kanal ID (!!! O'ZING QO'YASAN)
const PRIVATE_CHANNEL_ID = -1003531748359  -1003859050749  -1003830402105;



// PUBLIC kanal
const channels = [
  { name: "CHANEL", username: "@sheraliyevich_web" }
];

// PRIVATE linklar
const joinLinks = [
  { name: "1K", link: "https://t.me/+CAohVwhcnnE2NmI6" },
  { name: "2K", link: "https://t.me/+Rf02uu6fVm4yMDI6" },
  { name: "3K", link: "https://t.me/+lqbcrISkeSBiMzNi" }
];

// Fayllar
const files = {
  '1': { type: 'video', file: 'video.mp4', caption: "🎬 Video" },
  '2': { type: 'document', file: 'file.pdf', caption: "📄 Hujjat" },
  '3': { type: 'document', file: 'web.zip', caption: "🌐 Web sahifa" },
  '4': { type: 'document', file: 'Portfolio.zip', caption: "📁 Portfolio" }
};

// 📌 Fayl tekshirish
function getFilePath(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

// 🔥 JOIN REQUEST (ENG MUHIM QISM)
bot.on('chat_join_request', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  console.log(`Zayavka keldi: ${userId}`);

  try {
    // avtomatik approve
    await bot.approveChatJoinRequest(chatId, userId);

    // ozgina kutib member bo‘lganini tekshiramiz
    setTimeout(async () => {
      try {
        const member = await bot.getChatMember(chatId, userId);

        if (member.status === 'member') {
          requestedUsers.add(userId);
          userCache.set(userId, true);
          console.log(`User tasdiqlandi: ${userId}`);
        }
      } catch (e) {
        console.log("Member check error:", e.message);
      }
    }, 2000);

  } catch (err) {
    console.log("Approve error:", err.message);
  }
});

// 🔒 OBUNA TEKSHIRISH (UPDATE)
async function checkSubscription(userId) {

  // cache
  if (userCache.get(userId)) return true;

  // 🔥 PRIVATE kanal tekshirish
  if (!requestedUsers.has(userId)) {
    return false;
  }

  // 🔥 PUBLIC kanal tekshirish
  try {
    for (const ch of channels) {
      const member = await bot.getChatMember(ch.username, userId);

      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        return false;
      }
    }

    userCache.set(userId, true);
    return true;

  } catch (err) {
    console.log("Check error:", err.message);
    return false;
  }
}

// 🎛 Keyboard
function getJoinKeyboard() {
  return {
    inline_keyboard: [
      ...channels.map(ch => [
        { text: `📢 ${ch.name}`, url: `https://t.me/${ch.username.replace('@', '')}` }
      ]),
      ...joinLinks.map(ch => [
        { text: `🔗 ${ch.name}`, url: ch.link }
      ]),
      [{ text: '✅ Tekshirish', callback_data: 'check' }]
    ]
  };
}

// Express
app.use(express.json());

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} da ishlayapti`);
});

// START
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const ok = await checkSubscription(userId);

  if (!ok) {
    return bot.sendMessage(chatId,
      "📢 <b>Barcha kanallarga obuna bo‘ling:</b>",
      { parse_mode: 'HTML', reply_markup: getJoinKeyboard() }
    );
  }

  bot.sendMessage(chatId, "🔢 Raqam yuboring (1-4):");
});

// BUTTON
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === 'check') {
    const ok = await checkSubscription(userId);

    if (ok) {
      bot.sendMessage(chatId, "✅ Tasdiqlandi!\n🔢 Endi raqam yuboring:");
    } else {
      bot.sendMessage(chatId, "❌ Hali ham obuna bo‘lmadingiz!");
    }
  }

  bot.answerCallbackQuery(q.id);
});

// MESSAGE
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const ok = await checkSubscription(userId);
  if (!ok) {
    return bot.sendMessage(chatId, "🚫 Avval obuna bo‘ling!", {
      reply_markup: getJoinKeyboard()
    });
  }

  const data = files[text];
  if (!data) {
    return bot.sendMessage(chatId, "❌ Noto‘g‘ri raqam (1-4)");
  }

  const filePath = getFilePath(data.file);
  if (!filePath) {
    return bot.sendMessage(chatId, "⚠️ Fayl topilmadi");
  }

  try {
    if (data.type === 'video') {
      await bot.sendVideo(chatId, filePath, { caption: data.caption });
    } else {
      await bot.sendDocument(chatId, filePath, { caption: data.caption });
    }
  } catch (err) {
    console.log("Send error:", err.message);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
  }
});