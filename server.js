const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const cron = require("node-cron");
const { generateFoodFact } = require("./gemini-facts");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const DATA_DIR = process.env.RECIPE_DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "recipes.json");
const MONGODB_URI = process.env.MONGODB_URI || null;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BASE_URL = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : null;
const SITE_URL =
  process.env.SITE_URL ||
  process.env.PUBLIC_URL ||
  "https://food-sgk6.onrender.com";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const INITIAL_RECIPES = [
  {
    id: "borsch",
    title: "Борщ зі сметаною",
    description:
      "Класичний червоний борщ з буряком, капустою, квасолею, картоплею та ароматною сметаною. Подається гарячим з пампушками або чорним хлібом.",
    time: "60 хв",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "vareniki",
    title: "Вареники з картоплею та цибулею",
    description:
      "Ніжні домашні вареники з картопляно-цибулевою начинкою. Подаються зі смаженою цибулею та сметаною. Традиційна українська страва для всієї родини.",
    time: "90 хв",
    image:
      "https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deruny",
    title: "Деруни зі сметаною",
    description:
      "Хрусткі картопляні деруни, смажені до золотистої скоринки на олії. Подаються гарячими зі сметаною або грибним соусом. Улюблений сніданок або вечеря.",
    time: "40 хв",
    image:
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "holubtsi",
    title: "Голубці в томатному соусі",
    description:
      "Соковиті голубці з фаршем і рисом, загорнуті у свіже капустяне листя та тушковані в ніжному томатному соусі зі сметаною.",
    time: "120 хв",
    image:
      "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "nalisnyky",
    title: "Налисники з сиром",
    description:
      "Тоненькі млинці-налисники з ніжною начинкою з сиру, яєць та цукру. Запікаються в духовці зі сметаною до апетитної рум'яності.",
    time: "50 хв",
    image:
      "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "pampushky",
    title: "Пампушки з часниковою олією",
    description:
      "М'які пухкі пампушки з дріжджового тіста, политі ароматною часниковою олією з кропом. Ідеальне доповнення до борщу або самостійна закуска.",
    time: "120 хв",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hrechka",
    title: "Гречана каша з грибами",
    description:
      "Розсипчаста гречана каша, тушкована з лісовими грибами, цибулею і морквою. Ситна і корисна страва, яку готували ще наші бабусі.",
    time: "35 хв",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "kyiv-kotleta",
    title: "Котлета по-київськи",
    description:
      "Соковита куряча котлета з вершковим маслом і зеленню всередині, паніровані і смажені до золотистої скоринки. Ресторанна класика рідного краю.",
    time: "60 хв",
    image:
      "https://images.unsplash.com/photo-1562802378-063ec186a863?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "yushka",
    title: "Юшка рибна з карасем",
    description:
      "Запашна домашня юшка з карасем, картоплею, цибулею та зеленню. Варена на повільному вогні, зберігає весь смак свіжої річкової риби.",
    time: "50 хв",
    image:
      "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "syrniky",
    title: "Сирники зі сметаною",
    description:
      "Повітряні сирники — улюблений сніданок, що готується за 30 хвилин. М'які всередині, з апетитною золотистою скоринкою.\n\nІнгредієнти:\n- 500 г м'якого сиру\n- 2 яйця\n- 3 ст. л. цукру\n- 1 пакет ванільного цукру\n- щіпка солі\n- 5–6 ст. л. борошна (+ для обвалювання)\n- олія для смаження\n\nПриготування:\n1. Розім'яти сир виделкою до однорідності — без великих грудочок.\n2. Додати яйця, цукор, ванільний цукор та сіль. Добре перемішати.\n3. Всипати борошно і замісити м'яке тісто, що не липне до рук.\n4. Сформувати кульки, обваляти в борошні, злегка приплющити.\n5. Смажити на розігрітій олії по 3–4 хвилини з кожного боку до золотистої скоринки.\n6. Подавати теплими зі сметаною, варенням або свіжими ягодами.",
    time: "30 хв",
    image:
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "kapusniak",
    title: "Капусняк зі свіжою капустою",
    description:
      "Наваристий капусняк — традиційний суп із доступних продуктів, що зігріває і насичує. Готується просто, а смак — як у бабусі.\n\nІнгредієнти:\n- 500 г свинини на кістці\n- 300 г свіжої капусти\n- 3 середні картоплини\n- 1 морква\n- 1 цибулина\n- 2 ст. л. томатної пасти\n- сіль, чорний перець, лавровий лист\n- пучок кропу до подачі\n\nПриготування:\n1. М'ясо залити 2 л холодної води, довести до кипіння, зняти піну.\n2. Варити на помірному вогні 50–60 хвилин до м'якості.\n3. Вийняти м'ясо, відокремити від кістки, нарізати шматочками.\n4. Капусту нашаткувати, картоплю нарізати кубиками, покласти в бульйон.\n5. Цибулю й моркву дрібно нарізати, обсмажити на олії 5 хвилин.\n6. Додати томатну пасту до зажарки, потушкувати 2 хвилини.\n7. Зажарку вилити в суп, варити ще 20 хвилин до м'якості овочів.\n8. Повернути м'ясо, посолити, поперчити, додати лавровий лист.\n9. Подавати зі сметаною та свіжим кропом.",
    time: "90 хв",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "medivnyk",
    title: "Медовик домашній",
    description:
      "Класичний медовий торт із ніжними коржами та кремом зі сметани. Просочений, м'який і неймовірно ароматний — смак дитинства.\n\nІнгредієнти:\n- 3 ст. л. натурального меду\n- 150 г вершкового масла\n- 3 яйця\n- 200 г цукру\n- 1 ч. л. соди\n- 400 г борошна\n\nКрем:\n- 800 г сметани (20–25%)\n- 150 г цукрової пудри\n\nПриготування:\n1. На водяній бані розтопити масло з медом і цукром, помішуючи.\n2. Зняти з вогню, всипати соду — маса спіниться і збільшиться.\n3. Дати охолонути до теплого стану, додати яйця, перемішати.\n4. Поступово додати борошно і замісити м'яке тісто.\n5. Розділити на 8 рівних частин, загорнути у плівку, охолодити 30 хвилин.\n6. Кожну частину тонко розкатати (2–3 мм) та обрізати по шаблону.\n7. Випікати кожен корж при 180°C 5–7 хвилин до золотистості.\n8. Обрізки подрібнити в крихту — для посипки торта.\n9. Збити сметану з цукровою пудрою до пишності.\n10. Рясно змастити кожен корж кремом і скласти торт.\n11. Обсипати крихтою зверху та з боків. Охолоджувати 6–8 годин.",
    time: "180 хв",
    image:
      "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=800&q=80",
  },
];

let recipesCol = null;
let factTitlesCol = null;

async function initStorage() {
  if (MONGODB_URI) {
    try {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db("recipe-site");
      recipesCol = db.collection("recipes");
      factTitlesCol = db.collection("fact-titles");
      // Upsert each initial recipe — adds missing ones, skips existing
      for (const recipe of INITIAL_RECIPES) {
        await recipesCol.updateOne(
          { id: recipe.id },
          { $setOnInsert: { ...recipe } },
          { upsert: true },
        );
      }
      console.log("MongoDB: initial recipes synced");
      console.log("Storage: MongoDB connected");
    } catch (err) {
      console.error(
        "MongoDB connection failed, falling back to file:",
        err.message,
      );
      recipesCol = null;
      ensureDataFile();
    }
  } else {
    ensureDataFile();
    console.log("Storage: file system (DATA_DIR=" + DATA_DIR + ")");
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(INITIAL_RECIPES, null, 2),
      "utf8",
    );
  }
}

async function readRecipes() {
  if (recipesCol) {
    return recipesCol.find({}, { projection: { _id: 0 } }).toArray();
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Не вдалося прочитати recipes.json", error);
    return [];
  }
}

async function createRecipe(recipe) {
  if (recipesCol) {
    await recipesCol.insertOne({ ...recipe });
    return recipe;
  }
  const recipes = await readRecipes();
  recipes.push(recipe);
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
  return recipe;
}

async function updateRecipe(id, payload) {
  if (recipesCol) {
    const existing = await recipesCol.findOne(
      { id },
      { projection: { _id: 0 } },
    );
    if (!existing) return null;
    const updated = {
      id,
      title: payload.title || existing.title,
      description: payload.description || existing.description,
      time: payload.time || existing.time,
      image: payload.image || existing.image,
    };
    await recipesCol.updateOne({ id }, { $set: updated });
    return updated;
  }
  const recipes = await readRecipes();
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  recipes[index] = {
    ...recipes[index],
    title: payload.title || recipes[index].title,
    description: payload.description || recipes[index].description,
    time: payload.time || recipes[index].time,
    image: payload.image || recipes[index].image,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
  return recipes[index];
}

async function deleteRecipe(id) {
  if (recipesCol) {
    const result = await recipesCol.deleteOne({ id });
    return result.deletedCount > 0;
  }
  const recipes = await readRecipes();
  const filtered = recipes.filter((r) => r.id !== id);
  if (filtered.length === recipes.length) return false;
  fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), "utf8");
  return true;
}

function sendResponse(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

async function getTelegramMessageId(recipeId) {
  if (recipesCol) {
    const doc = await recipesCol.findOne(
      { id: recipeId },
      { projection: { _id: 0, telegramMessageId: 1 } },
    );
    return doc?.telegramMessageId || null;
  }
  const recipes = await readRecipes();
  const recipe = recipes.find((r) => r.id === recipeId);
  return recipe?.telegramMessageId || null;
}

async function saveTelegramMessageId(recipeId, messageId) {
  if (recipesCol) {
    await recipesCol.updateOne(
      { id: recipeId },
      { $set: { telegramMessageId: messageId } },
    );
    return;
  }
  const recipes = await readRecipes();
  const index = recipes.findIndex((r) => r.id === recipeId);
  if (index !== -1) {
    recipes[index].telegramMessageId = messageId;
    fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
  }
}

async function sendTelegramRecipePost(recipe) {
  if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) {
    console.log("Telegram not configured: missing token or chat_id");
    return;
  }

  const safeText = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const description = safeText(recipe.description || "");
  const shortDescription =
    description.length > 400 ? `${description.slice(0, 400)}...` : description;

  const caption =
    `<b>${safeText(recipe.title)}</b>\n` +
    `<b>Час приготування:</b> ${safeText(recipe.time)}\n\n` +
    `${shortDescription}\n\n` +
    `<a href="${SITE_URL}">Наш сайт</a>`;

  const imageUrl =
    recipe.image && recipe.image.startsWith("http") ? recipe.image : null;

  try {
    let response;
    if (imageUrl) {
      response = await fetch(`${TELEGRAM_BASE_URL}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          photo: imageUrl,
          caption,
          parse_mode: "HTML",
        }),
      });
    } else {
      response = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });
    }
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram send failed: ${response.status} ${errorText}`);
    } else {
      const data = await response.json();
      const messageId = data?.result?.message_id;
      if (messageId) {
        await saveTelegramMessageId(recipe.id, messageId);
        console.log(`Telegram message sent, id=${messageId}`);
      }
    }
  } catch (error) {
    console.error("Telegram notification error:", error);
  }
}

async function editTelegramRecipePost(recipe) {
  if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) return;

  const messageId = await getTelegramMessageId(recipe.id);
  if (!messageId) {
    // No existing message — send new one
    await sendTelegramRecipePost(recipe);
    return;
  }

  const safeText = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const description = safeText(recipe.description || "");
  const shortDescription =
    description.length > 400 ? `${description.slice(0, 400)}...` : description;

  const caption =
    `<b>${safeText(recipe.title)}</b>\n` +
    `<b>Час приготування:</b> ${safeText(recipe.time)}\n\n` +
    `${shortDescription}\n\n` +
    `<a href="${SITE_URL}">Наш сайт</a>`;

  try {
    const response = await fetch(`${TELEGRAM_BASE_URL}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_id: messageId,
        caption,
        parse_mode: "HTML",
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram edit failed: ${response.status} ${errorText}`);
    } else {
      console.log(`Telegram message edited, id=${messageId}`);
    }
  } catch (error) {
    console.error("Telegram edit error:", error);
  }
}

async function deleteTelegramRecipePost(recipeId) {
  if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) return;

  const messageId = await getTelegramMessageId(recipeId);
  if (!messageId) return;

  try {
    const response = await fetch(`${TELEGRAM_BASE_URL}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_id: messageId,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram delete failed: ${response.status} ${errorText}`);
    } else {
      console.log(`Telegram message deleted, id=${messageId}`);
    }
  } catch (error) {
    console.error("Telegram delete error:", error);
  }
}

function serveStaticFile(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    sendResponse(res, 403, "Доступ заборонено");
    return;
  }
  if (!fs.existsSync(filePath)) {
    sendResponse(res, 404, "Файл не знайдено");
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    sendResponse(res, 404, "Файл не знайдено");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  sendResponse(res, 200, content, contentType);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  const idMatch = pathname.match(/^\/api\/recipes\/(.+)$/);

  if (req.method === "GET" && pathname === "/api/recipes") {
    try {
      const recipes = await readRecipes();
      sendResponse(res, 200, JSON.stringify(recipes), "application/json");
    } catch {
      sendResponse(
        res,
        500,
        JSON.stringify({ error: "Помилка сервера" }),
        "application/json",
      );
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/recipes") {
    try {
      const payload = await parseBody(req);
      const id = `recipe-${Date.now()}`;
      const recipe = {
        id,
        title: payload.title || "Новий рецепт",
        description: payload.description || "",
        time: payload.time || "",
        image: payload.image || "",
      };
      await createRecipe(recipe);
      sendResponse(res, 201, JSON.stringify(recipe), "application/json");
      await sendTelegramRecipePost(recipe);
    } catch {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "Невірні дані" }),
        "application/json",
      );
    }
    return;
  }

  if (idMatch && req.method === "PUT") {
    const id = idMatch[1];
    try {
      const payload = await parseBody(req);
      const updated = await updateRecipe(id, payload);
      if (!updated) {
        sendResponse(
          res,
          404,
          JSON.stringify({ error: "Рецепт не знайдено" }),
          "application/json",
        );
        return;
      }
      sendResponse(res, 200, JSON.stringify(updated), "application/json");
      await editTelegramRecipePost(updated);
    } catch {
      sendResponse(
        res,
        400,
        JSON.stringify({ error: "Невірні дані" }),
        "application/json",
      );
    }
    return;
  }

  if (idMatch && req.method === "DELETE") {
    const id = idMatch[1];
    try {
      const deleted = await deleteRecipe(id);
      if (!deleted) {
        sendResponse(
          res,
          404,
          JSON.stringify({ error: "Рецепт не знайдено" }),
          "application/json",
        );
        return;
      }
      sendResponse(
        res,
        200,
        JSON.stringify({ success: true }),
        "application/json",
      );
      await deleteTelegramRecipePost(id);
    } catch {
      sendResponse(
        res,
        500,
        JSON.stringify({ error: "Помилка сервера" }),
        "application/json",
      );
    }
    return;
  }

  sendResponse(
    res,
    404,
    JSON.stringify({ error: "Не знайдено" }),
    "application/json",
  );
}

initStorage().then(() => {
  async function loadUsedFactTitles() {
    if (factTitlesCol) {
      const docs = await factTitlesCol
        .find({}, { projection: { _id: 0, title: 1 } })
        .toArray();
      return docs.map((d) => d.title);
    }
    const filePath = path.join(DATA_DIR, "used-fact-titles.json");
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return [];
    }
  }

  async function saveUsedFactTitle(title) {
    if (factTitlesCol) {
      await factTitlesCol.insertOne({ title, addedAt: new Date() });
      return;
    }
    const filePath = path.join(DATA_DIR, "used-fact-titles.json");
    const titles = await loadUsedFactTitles();
    titles.push(title);
    fs.writeFileSync(filePath, JSON.stringify(titles, null, 2), "utf8");
  }

  // Щоденні пости з цікавими фактами про їжу (09:00 і 19:00 за Києвом)
  async function postDailyFact() {
    if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) return;
    const usedTitles = await loadUsedFactTitles();
    const fact = await generateFoodFact(usedTitles);
    const text =
      `${fact.emoji} <b>${fact.title}</b>\n\n` +
      `${fact.text}\n\n` +
      `<a href="${SITE_URL}">🍽 Наш сайт з рецептами</a>`;
    try {
      const response = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (response.ok) {
        console.log(`Daily fact posted: ${fact.title}`);
        await saveUsedFactTitle(fact.title);
      } else {
        const err = await response.text();
        console.error(`Daily fact failed: ${err}`);
      }
    } catch (error) {
      console.error("Daily fact error:", error);
    }
  }

  // 09:00 Києв (UTC+3 = 06:00 UTC)
  cron.schedule("0 6 * * *", postDailyFact, { timezone: "Europe/Kyiv" });
  // 19:00 Києв (UTC+3 = 16:00 UTC)
  cron.schedule("0 19 * * *", postDailyFact, { timezone: "Europe/Kyiv" });
  console.log("Daily fact scheduler started (09:00 and 19:00 Kyiv time)");

  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/recipes")) {
      handleApi(req, res);
      return;
    }
    serveStaticFile(req, res);
  });

  server.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
  });
});
