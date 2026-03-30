require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const token = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const PORT = process.env.PORT || 3000;

const app = express();
const bot = new TelegramBot(token);

// Webhook yo‘li
const WEBHOOK_PATH = '/secret-path';

// Kanallar ro'yxati
const channels = [
  { name: "CHANEL", username: "@dgjoni_yt" },
  { name: "CHANEL", username: "@sheraliyevich_web" },
  { name: "CHANEL", username: "@dgjonipubgm" }
];

// Raqamlarga mos fayllar
const files = {
  '1': { type: 'video', path: path.join(__dirname, 'video1.mp4'), caption: "🎬 Mana siz so‘ragan video!" },
  '2': { type: 'document', path: path.join(__dirname, 'file.rar'), caption: "📄 Mana siz so‘ragan hujjat!" },
  '3': { type: 'document', path: path.join(__dirname, '3 HONA WEB SAHIFA.zip'), caption: "📄 3 HONA WEB SAHIFA!" },
  '4': { type: 'document', path: path.join(__dirname, 'Portfolio.zip'), caption: "📄 Portfolio!" }
};

// Foydalanuvchi obunasini tekshlash
async function checkSubscription(userId) {
  for (const ch of channels) {
    try {
      const member = await bot.getChatMember(ch.username, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        return false;
      }
    } catch (e) {
      console.error(`Kanalni tekshirishda xatolik: ${ch.username}`, e.message);
      return false;
    }
  }
  return true;
}

// Express JSON middleware
app.use(express.json());

// Webhook endpoint
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Webhookni ishga tushirish
(async () => {
  try {
    await bot.setWebHook(DOMAIN + WEBHOOK_PATH);
    app.listen(PORT, () => console.log(`Server ${PORT} portda ishga tushdi`));
    console.log('Webhook muvaffaqiyatli o‘rnatildi');
  } catch (error) {
    console.error('Webhook o‘rnatishda xatolik:', error);
  }
})();

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const subscribed = await checkSubscription(userId);

  if (!subscribed) {
    const keyboard = {
      inline_keyboard: [
        ...channels.map(ch => [{ text: ch.name, url: `https://t.me/${ch.username.replace('@','')}` }]),
        [{ text: '✅ Obuna bo‘ldim', callback_data: 'check_subscription' }]
      ]
    };
    bot.sendMessage(chatId, "📢 <b>Botdan foydalanish uchun barcha kanallarga obuna bo‘ling:</b>", { parse_mode: 'HTML', reply_markup: keyboard });
  } else {
    bot.sendMessage(chatId, "🔢 Iltimos, kerakli raqamni yuboring:", { parse_mode: 'HTML' });
  }
});

// "Obuna bo‘ldim" tugmasi
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  if (query.data === 'check_subscription') {
    const subscribed = await checkSubscription(userId);
    if (subscribed) {
      bot.sendMessage(chatId, "✅ Obunangiz tasdiqlandi. Endi kerakli raqamni yuboring:");
    } else {
      bot.sendMessage(chatId, "❌ Siz barcha kanallarga obuna bo‘lmagansiz. Iltimos, davom eting.");
    }
  }
  await bot.answerCallbackQuery(query.id);
});

// Foydalanuvchi raqam yuborganda fayl jo‘natish
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/start')) return;

  const subscribed = await checkSubscription(userId);
  if (!subscribed) return bot.sendMessage(chatId, "🚫 Iltimos, avval barcha kanallarga obuna bo‘ling.");

  if (!files.hasOwnProperty(text)) return bot.sendMessage(chatId, "⚠️ Kechirasiz, bunday raqam mavjud emas.");

  const file = files[text];
  try {
    if (file.type === 'video') await bot.sendVideo(chatId, file.path, { caption: file.caption });
    else if (file.type === 'document') await bot.sendDocument(chatId, file.path, { caption: file.caption });
    else bot.sendMessage(chatId, "⚠️ Fayl turi noto‘g‘ri belgilangan.");
  } catch (error) {
    console.error("Fayl yuborishda xatolik:", error);
    bot.sendMessage(chatId, "❌ Faylni yuborishda xatolik yuz berdi.");
  }
});