const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const DATA_DIR = process.env.RECIPE_DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "recipes.json");

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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = [
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function readRecipes() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Не вдалося прочитати recipes.json", error);
    return [];
  }
}

function writeRecipes(recipes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
}

function sendResponse(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

async function sendTelegramMessage(text, buttonUrl = null) {
  if (!TELEGRAM_BASE_URL || !TELEGRAM_CHAT_ID) {
    console.log("Telegram not configured: missing token or chat_id");
    return;
  }

  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "Переглянути рецепт", url: buttonUrl }]],
    };
  }

  try {
    const response = await fetch(`${TELEGRAM_BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram send failed: ${response.status} ${errorText}`);
    } else {
      console.log("Telegram message sent successfully");
    }
  } catch (error) {
    console.error("Telegram notification error:", error);
  }
}

function formatTelegramRecipe(recipe, action = "Новий") {
  const safeText = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const description = safeText(recipe.description || "");
  const shortDescription =
    description.length > 400 ? `${description.slice(0, 400)}...` : description;

  return (
    `🔔 <b>${action} рецепт</b>\n\n` +
    `<b>Назва:</b> ${safeText(recipe.title)}\n` +
    `<b>Час приготування:</b> ${safeText(recipe.time)}\n\n` +
    `<b>Опис:</b> ${shortDescription}`
  );
}

function serveStaticFile(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

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

function handleApi(req, res) {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  const idMatch = pathname.match(/^\/api\/recipes\/(.+)$/);
  const recipes = readRecipes();

  if (req.method === "GET" && pathname === "/api/recipes") {
    sendResponse(res, 200, JSON.stringify(recipes), "application/json");
    return;
  }

  if (req.method === "POST" && pathname === "/api/recipes") {
    parseBody(req)
      .then(async (payload) => {
        const id = `recipe-${Date.now()}`;
        const recipe = {
          id,
          title: payload.title || "Новий рецепт",
          description: payload.description || "",
          time: payload.time || "",
          image: payload.image || "",
        };
        recipes.push(recipe);
        writeRecipes(recipes);
        sendResponse(res, 201, JSON.stringify(recipe), "application/json");
        const recipeUrl = `${SITE_URL}#${encodeURIComponent(recipe.id)}`;
        await sendTelegramMessage(
          formatTelegramRecipe(recipe, "Новий"),
          recipeUrl,
        );
      })
      .catch(() =>
        sendResponse(
          res,
          400,
          JSON.stringify({ error: "Невірні дані" }),
          "application/json",
        ),
      );
    return;
  }

  if (idMatch && req.method === "PUT") {
    const id = idMatch[1];
    parseBody(req)
      .then(async (payload) => {
        const index = recipes.findIndex((item) => item.id === id);
        if (index === -1) {
          sendResponse(
            res,
            404,
            JSON.stringify({ error: "Рецепт не знайдено" }),
            "application/json",
          );
          return;
        }
        recipes[index] = {
          ...recipes[index],
          title: payload.title || recipes[index].title,
          description: payload.description || recipes[index].description,
          time: payload.time || recipes[index].time,
          image: payload.image || recipes[index].image,
        };
        writeRecipes(recipes);
        sendResponse(
          res,
          200,
          JSON.stringify(recipes[index]),
          "application/json",
        );
        const recipeUrl = `${SITE_URL}#${encodeURIComponent(recipes[index].id)}`;
        await sendTelegramMessage(
          formatTelegramRecipe(recipes[index], "Оновлено"),
          recipeUrl,
        );
      })
      .catch(() =>
        sendResponse(
          res,
          400,
          JSON.stringify({ error: "Невірні дані" }),
          "application/json",
        ),
      );
    return;
  }

  if (idMatch && req.method === "DELETE") {
    const id = idMatch[1];
    const filtered = recipes.filter((item) => item.id !== id);
    if (filtered.length === recipes.length) {
      sendResponse(
        res,
        404,
        JSON.stringify({ error: "Рецепт не знайдено" }),
        "application/json",
      );
      return;
    }
    writeRecipes(filtered);
    sendResponse(
      res,
      200,
      JSON.stringify({ success: true }),
      "application/json",
    );
    return;
  }

  sendResponse(
    res,
    404,
    JSON.stringify({ error: "Не знайдено" }),
    "application/json",
  );
}

ensureDataFile();
console.log(`DATA_DIR: ${DATA_DIR}`);

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
