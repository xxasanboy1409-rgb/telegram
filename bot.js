require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const token = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;

const app = express();
const PORT = process.env.PORT || 3000;

// Webhook yo‘li
const WEBHOOK_PATH = `/bot${token}`;

const bot = new TelegramBot(token);
bot.setWebHook(`${DOMAIN}${WEBHOOK_PATH}`);

// Faqat username bor kanallar (tekshirish uchun)
const channels = [
  { name: "CHANEL", username: "@sheraliyevich_web" }
];

// Link-only kanallar (faqat ko‘rsatish uchun)
const joinLinks = [
  { name: "1K", link: "https://t.me/+hxFSNywQS8w3Yjc6" },
  { name: "2K", link: "https://t.me/+cRKttnQsQPxkZjM6" },
  { name: "3K", link: "https://t.me/+rSdf0a0lfy4xZGZi" }
];

// Fayllar
const files = {
  '1': { type: 'video', path: path.join(__dirname, 'video.mp4'), caption: "🎬 Video" },
  '2': { type: 'document', path: path.join(__dirname, 'file.pdf'), caption: "📄 Hujjat" },
  '3': { type: 'document', path: path.join(__dirname, 'web.zip'), caption: "🌐 Web sahifa" },
  '4': { type: 'document', path: path.join(__dirname, 'Portfolio.zip'), caption: "📁 Portfolio" }
};

// Obuna tekshirish
async function checkSubscription(userId) {
  try {
    for (const ch of channels) {
      const member = await bot.getChatMember(ch.username, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.log("Check error:", err.message);
    return false;
  }
}

// Klaviatura
function getJoinKeyboard() {
  return {
    inline_keyboard: [
      ...channels.map(ch => [
        { text: ch.name, url: `https://t.me/${ch.username.replace('@', '')}` }
      ]),
      ...joinLinks.map(ch => [
        { text: ch.name, url: ch.link }
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
  console.log(`Server ${PORT} da ishlayapti`);
});

// START
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const ok = await checkSubscription(userId);

  if (!ok) {
    return bot.sendMessage(chatId,
      "📢 <b>Kanallarga obuna bo‘ling:</b>",
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
      bot.sendMessage(chatId, "✅ Tasdiqlandi! Endi raqam yuboring.");
    } else {
      bot.sendMessage(chatId, "❌ Hali ham obuna emassiz!");
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

  const file = files[text];
  if (!file) {
    return bot.sendMessage(chatId, "❌ Noto‘g‘ri raqam (1-4)");
  }

  try {
    if (file.type === 'video') {
      await bot.sendVideo(chatId, file.path, { caption: file.caption });
    } else {
      await bot.sendDocument(chatId, file.path, { caption: file.caption });
    }
  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
  }
});