require('dotenv').config();

const express = require('express');
const { link } = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const token = process.env.BOT_TOKEN;
const app = express();
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(token);
// Approved (zayavka yuborgan) users
const approvedUsers = new Set();

// Webhook uchun maxfiy yo‘l
const WEBHOOK_PATH = '/secret-path';

// Kanallar ro'yxati
 const channels = [
  { name: "CHANEL", username: "@sheraliyevich_web" }, // public
  { name: "1K", link: "https://t.me/+hxFSNywQS8w3Yjc6" },
  { name: "2K", link: "https://t.me/+cRKttnQsQPxkZjM6" },
  { name: "3K", link: "https://t.me/+rSdf0a0lfy4xZGZi" }
];

// Raqamlarga mos fayllar ro'yxati
const files = {
  '1': { type: 'video', path: path.join(__dirname, 'video1.mp4'), caption: "🎬 Mana siz so‘ragan video!" },
  '2': { type: 'document', path: path.join(__dirname, 'file.rar'), caption: "📄 Mana siz so‘ragan hujjat!" },
  '3': { type: 'document', path: path.join(__dirname, '3 HONA WEB SAHIFA.zip'), caption: "📄 3 HONA WEB SAHIFA!" },
  '4': { type: 'document', path: path.join(__dirname, 'Portfolio.zip'), caption: "📄 Portfolio!" }
};

// Foydalanuvchi barcha kanallarga obuna bo‘lganini tekshirish funksiyasi
async function checkSubscription(userId) {
  for (const ch of channels) {
    if (!ch.username) continue; // faqat public tekshirish
    
    try {
      const member = await bot.getChatMember(ch.username, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        return false;
      }
    } catch (e) {
      console.error(`Xatolik: ${ch.username}`, e.message);
      return false;
    }
  }
  return true;
}
// Express JSON qabul qilish uchun middleware
app.use(express.json());

// Webhook endpoint (faqat bitta kerak, takrorlanmasligi uchun ikkisini birlashtirdim)
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Webhook URL (o‘zingizning domeningiz bilan almashtiring)
const DOMAIN = process.env.DOMAIN || 'https://your-render-url.onrender.com';

// Server va webhookni ishga tushirish
(async () => {
  try {
    await bot.setWebHook(DOMAIN + WEBHOOK_PATH);
    app.listen(PORT, () => console.log(`Server ${PORT} portda ishga tushdi`));
    console.log('Webhook muvaffaqiyatli o‘rnatildi');
  } catch (error) {
    console.error('Webhook o‘rnatishda xatolik:', error);
  }
})();
// 🔥 PRIVATE kanal uchun auto approve
bot.on('chat_join_request', async (req) => {
  try {
    await bot.approveChatJoinRequest(req.chat.id, req.from.id);
    approvedUsers.add(req.from.id); // <<< private zayavka flag
    console.log(`User qabul qilindi: ${req.from.id}`);
  } catch (e) {
    console.log("Approve error:", e.message);
  }
});

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const subscribed = await checkSubscription(userId);
  const privateOk = approvedUsers.has(userId); // <<< bu qatorni qo‘shish

  if (!subscribed || !privateOk) {             // <<< bu qatorni o‘zgartirish
    const keyboard = {
      inline_keyboard: [
        ...channels.map(ch => [{ text: ch.name,
          url: ch.link ? ch.link : `https://t.me/${ch.username.replace('@', '')}` }]),
        [{ text: '✅ Obuna bo‘ldim', callback_data: 'check_subscription' }]
      ]
    };

    return bot.sendMessage(chatId, "📢 <b>Botdan foydalanish uchun barcha kanallarga obuna bo‘ling va private kanallarda zayavka tashlang:</b>", {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  bot.sendMessage(chatId, "🔢 Endi kerakli raqamni yuboring:", { parse_mode: 'HTML' });
});

// "Obuna bo‘ldim" tugmasi bosilganda obunani qayta tekshirish
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === 'check_subscription') {
    const subscribed = await checkSubscription(userId);
    const privateOk = approvedUsers.has(userId); // <<< bu qatorni qo‘shish

    if (!subscribed || !privateOk) {            // <<< bu qatorni o‘zgartirish
      return bot.sendMessage(chatId, "❌ Avval barcha public kanallarga obuna bo‘ling va private kanallarda zayavka tashlang!");
    }

    bot.sendMessage(chatId, "✅ Endi barcha shart bajarildi. Kerakli raqamni yuboring:");
  }

  await bot.answerCallbackQuery(query.id);
});

// Foydalanuvchi raqam yuborganida faylni jo‘natish
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text) return;
  if (text.startsWith('/start')) return; // /start allaqachon ishlangan

  const subscribed = await checkSubscription(userId);
  const privateOk = approvedUsers.has(userId); // <<< bu qatorni qo‘shish

  if (!subscribed || !privateOk) {            // <<< bu qatorni o‘zgartirish
    return bot.sendMessage(chatId, "🚫 Avval barcha public kanallarga obuna bo‘ling va private kanallarda zayavka tashlang.");
  }

  if (!files.hasOwnProperty(text)) {
    return bot.sendMessage(chatId, "⚠️ Kechirasiz, bunday raqam mavjud emas.");
  }

  const file = files[text];
  try {
    if (file.type === 'video') {
      await bot.sendVideo(chatId, file.path, { caption: file.caption });
    } else if (file.type === 'document') {
      await bot.sendDocument(chatId, file.path, { caption: file.caption });
    } else {
      bot.sendMessage(chatId, "⚠️ Fayl turi noto‘g‘ri belgilangan.");
    }
  } catch (error) {
    console.error("Fayl yuborishda xatolik:", error);
    bot.sendMessage(chatId, "❌ Faylni yuborishda xatolik yuz berdi.");
  }
});

