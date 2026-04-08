const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const cron = require("node-cron");
const { generateFoodFact } = require("./gemini-facts");
const INITIAL_RECIPES = require("./data/initial-recipes");

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
  "https://www.food-volt.pp.ua";
const TELEGRAM_CHANNEL_URL = "https://t.me/food_volt";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

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
      // Upsert each initial recipe: add new ones, update description for existing
      const newlyAdded = [];
      for (const recipe of INITIAL_RECIPES) {
        const result = await recipesCol.updateOne(
          { id: recipe.id },
          {
            $setOnInsert: {
              id: recipe.id,
              title: recipe.title,
              time: recipe.time,
              image: recipe.image,
            },
            $set: { description: recipe.description },
          },
          { upsert: true },
        );
        if (result.upsertedCount > 0) {
          newlyAdded.push(recipe);
        }
      }
      console.log("MongoDB: initial recipes synced");
      // Post to Telegram all recipes that were never posted (no telegramMessageId)
      const unposted = await recipesCol
        .find(
          { telegramMessageId: { $exists: false } },
          { projection: { _id: 0 } },
        )
        .toArray();
      if (unposted.length > 0) {
        console.log(
          `Posting ${unposted.length} unposted recipe(s) to Telegram...`,
        );
        for (const recipe of unposted) {
          await sendTelegramRecipePost(recipe);
        }
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

async function getTelegramTextMessageId(recipeId) {
  if (recipesCol) {
    const doc = await recipesCol.findOne(
      { id: recipeId },
      { projection: { telegramTextMessageId: 1 } },
    );
    return doc?.telegramTextMessageId || null;
  }
  const recipes = await readRecipes();
  const recipe = recipes.find((r) => r.id === recipeId);
  return recipe?.telegramTextMessageId || null;
}

async function saveTelegramTextMessageId(recipeId, messageId) {
  if (recipesCol) {
    await recipesCol.updateOne(
      { id: recipeId },
      { $set: { telegramTextMessageId: messageId } },
    );
    return;
  }
  const recipes = await readRecipes();
  const index = recipes.findIndex((r) => r.id === recipeId);
  if (index !== -1) {
    recipes[index].telegramTextMessageId = messageId;
    fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
  }
}

function formatDescriptionForTelegram(description) {
  if (!description) return "";
  const SECTION_HEADERS = [
    "Інгредієнти",
    "Тісто",
    "Начинка",
    "Соус",
    "Глазур",
    "Декор",
    "Крем",
    "Приготування",
    "Подача",
  ];
  const safe = (t) =>
    String(t || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const lines = description.split("\n");
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    const isHeader = SECTION_HEADERS.some(
      (h) => trimmed === h + ":" || trimmed === h,
    );
    result.push(isHeader ? `<b>${safe(trimmed)}</b>` : safe(trimmed));
  }
  const text = result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 4000 ? text.slice(0, 4000) + "..." : text;
}

function buildTelegramMultipart(fields, imageBuffer, mimeType) {
  const boundary = "TGBoundary" + Date.now();
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  const ext = mimeType.split("/")[1] || "jpg";
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="photo.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return { body: Buffer.concat(parts), boundary };
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

  const caption =
    `<b>${safeText(recipe.title)}</b>\n` +
    `<b>Час приготування:</b> ${safeText(recipe.time)}\n\n` +
    `<a href="${SITE_URL}">🌐 Наш сайт</a> | <a href="${TELEGRAM_CHANNEL_URL}">📢 Telegram канал</a>`;

  const isHttpImage = recipe.image && recipe.image.startsWith("http");
  const isBase64Image = recipe.image && recipe.image.startsWith("data:");

  try {
    let photoMessageId = null;

    if (isHttpImage) {
      const response = await fetch(`${TELEGRAM_BASE_URL}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          photo: recipe.image,
          caption,
          parse_mode: "HTML",
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Telegram sendPhoto failed: ${response.status} ${errorText}`,
        );
        return;
      }
      const data = await response.json();
      photoMessageId = data?.result?.message_id;
      if (photoMessageId) {
        await saveTelegramMessageId(recipe.id, photoMessageId);
        console.log(`Telegram photo sent, id=${photoMessageId}`);
      }
    } else if (isBase64Image) {
      const match = recipe.image.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) {
        console.error("Invalid base64 image format for recipe:", recipe.id);
        return;
      }
      const mimeType = match[1];
      const imageBuffer = Buffer.from(match[2], "base64");
      const { body, boundary } = buildTelegramMultipart(
        { chat_id: TELEGRAM_CHAT_ID, caption, parse_mode: "HTML" },
        imageBuffer,
        mimeType,
      );
      const response = await fetch(`${TELEGRAM_BASE_URL}/sendPhoto`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Telegram sendPhoto (base64) failed: ${response.status} ${errorText}`,
        );
        return;
      }
      const data = await response.json();
      photoMessageId = data?.result?.message_id;
      if (photoMessageId) {
        await saveTelegramMessageId(recipe.id, photoMessageId);
        console.log(`Telegram photo (base64) sent, id=${photoMessageId}`);
      }
    } else {
      const response = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: caption,
          parse_mode: "HTML",
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Telegram sendMessage failed: ${response.status} ${errorText}`,
        );
        return;
      }
      const data = await response.json();
      photoMessageId = data?.result?.message_id;
      if (photoMessageId) {
        await saveTelegramMessageId(recipe.id, photoMessageId);
      }
    }

    // Send full description as a reply to the photo/message
    if (recipe.description && photoMessageId) {
      const fullText = formatDescriptionForTelegram(recipe.description);
      if (fullText) {
        const textResp = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: fullText,
            parse_mode: "HTML",
            reply_to_message_id: photoMessageId,
          }),
        });
        if (!textResp.ok) {
          const errorText = await textResp.text();
          console.error(
            `Telegram description reply failed: ${textResp.status} ${errorText}`,
          );
        } else {
          const textData = await textResp.json();
          const textMsgId = textData?.result?.message_id;
          if (textMsgId) {
            await saveTelegramTextMessageId(recipe.id, textMsgId);
            console.log(`Telegram description sent, id=${textMsgId}`);
          }
        }
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

  const caption =
    `<b>${safeText(recipe.title)}</b>\n` +
    `<b>Час приготування:</b> ${safeText(recipe.time)}\n\n` +
    `<a href="${SITE_URL}">🌐 Наш сайт</a> | <a href="${TELEGRAM_CHANNEL_URL}">📢 Telegram канал</a>`;

  try {
    // Edit photo caption
    const captionResp = await fetch(`${TELEGRAM_BASE_URL}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_id: messageId,
        caption,
        parse_mode: "HTML",
      }),
    });
    if (!captionResp.ok) {
      const errorText = await captionResp.text();
      console.error(
        `Telegram editCaption failed: ${captionResp.status} ${errorText}`,
      );
    } else {
      console.log(`Telegram caption edited, id=${messageId}`);
    }

    // Edit or send description text message
    if (recipe.description) {
      const fullText = formatDescriptionForTelegram(recipe.description);
      if (fullText) {
        const textMessageId = await getTelegramTextMessageId(recipe.id);
        if (textMessageId) {
          const editResp = await fetch(`${TELEGRAM_BASE_URL}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              message_id: textMessageId,
              text: fullText,
              parse_mode: "HTML",
            }),
          });
          if (!editResp.ok) {
            const errorText = await editResp.text();
            console.error(
              `Telegram editText failed: ${editResp.status} ${errorText}`,
            );
          } else {
            console.log(`Telegram description edited, id=${textMessageId}`);
          }
        } else {
          // No text message yet — send as reply
          const textResp = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: fullText,
              parse_mode: "HTML",
              reply_to_message_id: messageId,
            }),
          });
          if (textResp.ok) {
            const textData = await textResp.json();
            const newTextMsgId = textData?.result?.message_id;
            if (newTextMsgId) {
              await saveTelegramTextMessageId(recipe.id, newTextMsgId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Telegram edit error:", error);
  }
}

async function deleteTelegramRecipePost(recipeId) {
  if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) return;

  const messageId = await getTelegramMessageId(recipeId);
  if (!messageId) return;

  const deleteMessage = async (msgId) => {
    const response = await fetch(`${TELEGRAM_BASE_URL}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_id: msgId,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Telegram delete failed (id=${msgId}): ${response.status} ${errorText}`,
      );
    } else {
      console.log(`Telegram message deleted, id=${msgId}`);
    }
  };

  try {
    await deleteMessage(messageId);
    const textMessageId = await getTelegramTextMessageId(recipeId);
    if (textMessageId) {
      await deleteMessage(textMessageId);
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
      `<a href="${SITE_URL}">🍽 Наш сайт з рецептами</a> | <a href="${TELEGRAM_CHANNEL_URL}">📢 Telegram канал</a>`;
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

  const server = http.createServer(async (req, res) => {
    // Ручний тригер факту: GET /api/post-fact?secret=foodvolt2026
    if (req.method === "GET" && req.url.startsWith("/api/post-fact")) {
      const { query } = url.parse(req.url, true);
      if (query.secret !== "foodvolt2026") {
        sendResponse(
          res,
          403,
          JSON.stringify({ error: "Forbidden" }),
          "application/json",
        );
        return;
      }
      try {
        await postDailyFact();
        sendResponse(
          res,
          200,
          JSON.stringify({ ok: true, message: "Fact posted!" }),
          "application/json",
        );
      } catch (e) {
        sendResponse(
          res,
          500,
          JSON.stringify({ error: e.message }),
          "application/json",
        );
      }
      return;
    }

    // Перепостити всі рецепти в Telegram: GET /api/repost-all?secret=foodvolt2026
    if (req.method === "GET" && req.url.startsWith("/api/repost-all")) {
      const { query } = url.parse(req.url, true);
      if (query.secret !== "foodvolt2026") {
        sendResponse(
          res,
          403,
          JSON.stringify({ error: "Forbidden" }),
          "application/json",
        );
        return;
      }
      try {
        const recipes = await readRecipes();
        let posted = 0;
        for (const recipe of recipes) {
          // Видалити старі повідомлення
          await deleteTelegramRecipePost(recipe.id);
          // Скинути збережені ID
          if (recipesCol) {
            await recipesCol.updateOne(
              { id: recipe.id },
              { $unset: { telegramMessageId: "", telegramTextMessageId: "" } },
            );
          }
          // Надіслати заново з повним описом
          await sendTelegramRecipePost(recipe);
          posted++;
          // Пауза між постами щоб не перевищити ліміт Telegram API
          await new Promise((r) => setTimeout(r, 1500));
        }
        sendResponse(
          res,
          200,
          JSON.stringify({ ok: true, posted }),
          "application/json",
        );
      } catch (e) {
        sendResponse(
          res,
          500,
          JSON.stringify({ error: e.message }),
          "application/json",
        );
      }
      return;
    }
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
