const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const cron = require("node-cron");
const { getNextFact } = require("./facts");

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
      "Ніжний український борщ з буряком, капустою, картоплею та ароматною сметаною.",
    time: "60 хв",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "pasta",
    title: "Паста з помідорами і базиліком",
    description:
      "Швидкий та яскравий рецепт для обіду: італійська паста з оливковою олією та свіжими травами.",
    time: "25 хв",
    image:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "salad",
    title: "Салат з кіноа і авокадо",
    description:
      "Легкий, корисний салат з кіноа, авокадо, помідорами та лимонною заправкою.",
    time: "20 хв",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
  },
];

let recipesCol = null;

async function initStorage() {
  if (MONGODB_URI) {
    try {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db("recipe-site");
      recipesCol = db.collection("recipes");
      const count = await recipesCol.countDocuments();
      if (count === 0) {
        await recipesCol.insertMany(INITIAL_RECIPES.map((r) => ({ ...r })));
        console.log("MongoDB: seeded initial recipes");
      }
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
  // Щоденні пости з цікавими фактами про їжу (09:00 і 19:00 за Києвом)
  async function postDailyFact() {
    if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) return;
    const fact = getNextFact();
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
