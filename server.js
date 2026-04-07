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
      "Густий, ароматний, рубіново-червоний — справжній домашній борщ, що зігріває душу і тіло. Вариться з любов'ю, подається з пампушками і щедрою ложкою сметани.\n\nІнгредієнти:\n- 500 г свинини або яловичини на кістці\n- 1 великий буряк\n- 300 г капусти\n- 3 картоплини\n- 1 морква\n- 1 цибулина\n- 2 ст. л. томатної пасти\n- 100 г квасолі (відварна або консервована)\n- 2 зубчики часнику\n- сіль, чорний перець, лавровий лист\n- сметана та кріп до подачі\n\nПриготування:\n1. М'ясо залити 2.5 л холодної води, довести до кипіння, зняти піну. Варити 1 год.\n2. Буряк натерти на крупній тертці, обсмажити 5 хвилин на олії, додати томатну пасту і тушкувати ще 5 хвилин.\n3. Цибулю й моркву дрібно нарізати, обсмажити до м'якості.\n4. Капусту нашаткувати, картоплю нарізати кубиками.\n5. У бульйон покласти картоплю і капусту, варити 15 хвилин.\n6. Додати зажарку з цибулею, морквою та буряком. Варити ще 10 хвилин.\n7. Додати квасолю, лавровий лист, посолити, поперчити.\n8. Перед подачею видавити часник, настояти 10 хвилин.\n9. Подавати гарячим зі сметаною, кропом і пампушками.",
    time: "90 хв",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "vareniki",
    title: "Вареники з картоплею та цибулею",
    description:
      "М'які, пухкі, з ніжною картопляно-цибулевою начинкою — вареники, що пахнуть дитинством. На столі зникають миттєво, тож краще варити більше!\n\nІнгредієнти:\n\nТісто:\n- 2 склянки борошна\n- 1 яйце\n- 100 мл теплої води\n- щіпка солі\n\nНачинка:\n- 5 середніх картоплин\n- 2 великі цибулини\n- 50 г вершкового масла\n- сіль, чорний перець\n\nПриготування:\n1. Замісити тісто з борошна, яйця, води та солі. Вимісити до гладкості, загорнути у плівку, залишити на 30 хвилин.\n2. Картоплю зварити до м'якості, розім'яти у пюре.\n3. Одну цибулину дрібно нарізати, обсмажити до золотистості, змішати з пюре. Посолити, поперчити.\n4. Тісто розкатати у тонкий пласт (2–3 мм), вирізати кружальця.\n5. На кожен покласти начинку і защипнути краї.\n6. Варити у підсоленій воді 5–7 хвилин після спливання.\n7. Другу цибулину нарізати і обсмажити до золотистого кольору.\n8. Подавати вареники з смаженою цибулею і сметаною.",
    time: "90 хв",
    image:
      "https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deruny",
    title: "Деруни зі сметаною",
    description:
      "Хрусткі зовні і соковиті всередині — деруни по-домашньому. Простий рецепт, що перетворює звичайну картоплю на справжню смакоту. Найкращий сніданок чи вечеря!\n\nІнгредієнти:\n- 6 великих картоплин\n- 1 цибулина\n- 2 яйця\n- 3 ст. л. борошна\n- сіль, чорний перець\n- олія для смаження\n- сметана до подачі\n\nПриготування:\n1. Картоплю і цибулю натерти на дрібній тертці.\n2. Відтиснути зайву рідину через марлю або рукою.\n3. Додати яйця, борошно, сіль та перець. Добре перемішати.\n4. На розігріту сковорідку з олією викладати тісто ложкою, формуючи невеликі оладки.\n5. Смажити на середньому вогні по 3–4 хвилини з кожного боку до золотистої скоринки.\n6. Готові деруни промокнути серветкою від надлишку олії.\n7. Подавати гарячими зі сметаною або грибним соусом.",
    time: "40 хв",
    image:
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "holubtsi",
    title: "Голубці в томатному соусі",
    description:
      "Соковиті, ароматні, тушковані в густому томатному соусі — голубці, що нагадують домашній затишок. Страва для тих, хто цінує справжній смак.\n\nІнгредієнти:\n- 1 великий вилок капусти\n- 500 г змішаного фаршу (свинина + яловичина)\n- 1 склянка рису (варений напівготовий)\n- 2 цибулини\n- 1 морква\n- 3 ст. л. томатної пасти\n- 200 мл сметани\n- сіль, перець, лавровий лист\n\nПриготування:\n1. Капусту опустити в окріп на 5 хвилин — листя стане гнучким. Зрізати потовщення.\n2. Цибулю дрібно нарізати, моркву натерти. Половину обсмажити для фаршу, половину — для соусу.\n3. Фарш змішати з рисом, обсмаженою цибулею, сіллю та перцем.\n4. На кожен лист капусти покласти 2 ст. л. начинки і загорнути конвертиком.\n5. Обсмажити голубці на олії по 2 хвилини з кожного боку.\n6. Решту цибулі і моркви обсмажити, додати томатну пасту і сметану, розбавити водою (200 мл).\n7. Залити соусом голубці, додати лавровий лист.\n8. Тушкувати під кришкою на малому вогні 50–60 хвилин.",
    time: "120 хв",
    image:
      "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "nalisnyky",
    title: "Налисники з сиром",
    description:
      "Тоненькі, мереживні налисники з ніжною сирною начинкою — золота класика української кухні. Запечені в духовці зі сметаною, вони тануть у роті!\n\nІнгредієнти:\n\nТісто:\n- 2 яйця\n- 500 мл молока\n- 1 склянка борошна\n- 1 ст. л. цукру\n- щіпка солі\n- 2 ст. л. олії\n\nНачинка:\n- 500 г м'якого сиру\n- 2 яйця\n- 3 ст. л. цукру\n- 1 пакет ванільного цукру\n\nПриготування:\n1. Збити яйця з цукром і сіллю, влити молоко, поступово всипати борошно, вимішати без грудочок. Додати олію.\n2. Смажити тонкі млинці на розігрітій сковорідці без олії (або з мінімальною кількістю).\n3. Для начинки розтерти сир з яйцями, цукром і ваніллю до однорідності.\n4. На кожен млинець покласти 1–2 ст. л. начинки і загорнути конвертиком або трубочкою.\n5. Укласти налисники у форму, змащену маслом.\n6. Полити зверху сметаною і запікати при 180°C 25–30 хвилин до золотистості.",
    time: "50 хв",
    image:
      "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "pampushky",
    title: "Пампушки з часниковою олією",
    description:
      "Пухкі, м'які, з рум'яною скоринкою і духмяною часниковою олією — пампушки, що є невід'ємною частиною сервірування борщу. Але смачні і самі по собі!\n\nІнгредієнти:\n- 500 г борошна\n- 250 мл теплого молока\n- 7 г сухих дріжджів\n- 1 ст. л. цукру\n- 1 ч. л. солі\n- 2 ст. л. олії\n- 1 яйце для змащування\n\nЧасникова олія:\n- 4 зубчики часнику\n- 3 ст. л. олії\n- пучок кропу\n\nПриготування:\n1. Дріжджі змішати з цукром і теплим молоком, залишити на 10 хвилин до активації.\n2. Просіяти борошно, додати сіль, влити дріжджову суміш та олію. Замісити м'яке тісто.\n3. Накрити рушником і залишити у теплому місці на 1 годину.\n4. Тісто обім'яти, сформувати кульки розміром з мандарин.\n5. Укласти на деко, вкрите папером. Залишити ще на 20 хвилин.\n6. Змастити яйцем і випікати при 180°C 20–25 хвилин до золотистості.\n7. Часник видавити, змішати з олією та дрібно нарізаним кропом.\n8. Гарячі пампушки полити часниковою олією.",
    time: "120 хв",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hrechka",
    title: "Гречана каша з грибами",
    description:
      "Розсипчаста, ароматна, з насиченим лісовим смаком — гречана каша з грибами. Проста, корисна і неймовірно смачна страва, яка самостійно прогодує всю родину.\n\nІнгредієнти:\n- 1.5 склянки гречки\n- 300 г печериць або сушені лісові гриби\n- 1 велика цибулина\n- 1 морква\n- 3 ст. л. олії або вершкового масла\n- сіль, чорний перець, лавровий лист\n- свіжий кріп до подачі\n\nПриготування:\n1. Якщо лісові гриби сушені — замочити у холодній воді на 30 хвилин, відварити 20 хвилин.\n2. Гречку промити, підсушити на сухій сковорідці 2–3 хвилини.\n3. Цибулю дрібно нарізати, моркву натерти. Обсмажити на олії до золотистості.\n4. Гриби нарізати і додати до зажарки. Смажити ще 5 хвилин.\n5. Всипати гречку до грибів, залити 3 склянками гарячої води.\n6. Посолити, додати лавровий лист, довести до кипіння.\n7. Зменшити вогонь до мінімуму, накрити кришкою і варити 20 хвилин до повного вбирання води.\n8. Дати настоятися 5 хвилин, додати масло і перемішати. Подавати з кропом.",
    time: "35 хв",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "kyiv-kotleta",
    title: "Котлета по-київськи",
    description:
      "Хрустка паніровка, соковите куряче філе і розтоплене вершкове масло з зеленню всередині — котлета по-київськи завжди справляє враження. Ресторанна страва на домашній кухні!\n\nІнгредієнти:\n- 2 великі курячі філе\n- 100 г вершкового масла\n- пучок петрушки та кропу\n- 1 зубчик часнику\n- 2 яйця\n- 4 ст. л. борошна\n- 1 склянка панірувальних сухарів\n- сіль, чорний перець\n- олія для смаження\n\nПриготування:\n1. М'яке масло змішати з дрібно нарізаною зеленню та часником. Скачати ковбаску у харчовій плівці, заморозити 30 хвилин.\n2. Філе розрізати вздовж, не дорізаючи до кінця, розгорнути як книжку. Відбити до товщини 5–7 мм.\n3. Посолити, поперчити. По центру кожного філе покласти заморожений шматочок масла.\n4. Щільно загорнути філе навколо масла, формуючи котлету. Защипнути краї.\n5. Обваляти в борошні → вмочити в збите яйце → обваляти в сухарях. Повторити двічі.\n6. Смажити на олії по 4 хвилини з кожного боку до золотистості.\n7. Довести до готовності в духовці при 180°C 15 хвилин.",
    time: "60 хв",
    image:
      "https://images.unsplash.com/photo-1562802378-063ec186a863?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "yushka",
    title: "Юшка рибна з карасем",
    description:
      "Прозора, золотиста, з ніжним рибним смаком — домашня юшка з карасем. Готується на повільному вогні, щоб зберегти весь аромат свіжої річкової риби.\n\nІнгредієнти:\n- 2–3 каراси (700–900 г)\n- 4 картоплини\n- 1 цибулина\n- 1 морква\n- 2 лаврові листи\n- 5–6 горошин чорного перцю\n- пучок петрушки та кропу\n- сіль\n\nПриготування:\n1. Рибу почистити, промити. Великі шматки можна розрізати.\n2. Залити 2 л холодної води, довести до кипіння, зняти піну.\n3. Додати цілу цибулину, моркву, лавровий лист і перець.\n4. Зменшити вогонь і варити на повільному вогні 20 хвилин.\n5. Вийняти рибу, цибулю і моркву. Бульйон процідити.\n6. Картоплю нарізати кубиками і варити у процідженому бульйоні 15 хвилин.\n7. Рибу відокремити від кісток, повернути до юшки.\n8. Посолити, додати нарізану зелень. Подавати гарячою з хлібом.",
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
    `<a href="${SITE_URL}">🌐 Наш сайт</a>`;

  const imageUrl =
    recipe.image && recipe.image.startsWith("http") ? recipe.image : null;

  try {
    let photoMessageId = null;

    if (imageUrl) {
      const response = await fetch(`${TELEGRAM_BASE_URL}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          photo: imageUrl,
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
    `<a href="${SITE_URL}">🌐 Наш сайт</a>`;

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
