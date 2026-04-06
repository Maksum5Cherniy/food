const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Fallback facts if Gemini is unavailable
const FALLBACK_FACTS = [
  {
    emoji: "🍕",
    title: "Піца — не з Неаполя?",
    text: "Хоча неаполітанська піца вважається класикою, перші плоскі коржі з начинкою готували ще стародавні єгиптяни та греки, за тисячоліття до Неаполя.",
  },
  {
    emoji: "🥐",
    title: "Круасан — угорський винахід",
    text: "Круасан придумали не французи. У 1683 році у Відні пекарі спекли булочку у формі місяця на честь перемоги над турками. Французи запозичили рецепт і зробили його знаменитим.",
  },
  {
    emoji: "🍫",
    title: "Шоколад тисячу років пили",
    text: "Протягом трьох тисяч років шоколад вживали як гіркий напій. Солодкими плитками він став лише у 1847 році, коли компанія Fry & Sons змішала какао з цукром і маслом.",
  },
  {
    emoji: "🥕",
    title: "Морква раніше була фіолетовою",
    text: "Дика морква мала фіолетовий колір. Помаранчева морква — результат селекції голландських фермерів XVII ст., що виводили нові сорти на честь правлячої династії Оранських.",
  },
  {
    emoji: "🍯",
    title: "Мед — єдина їжа, що не псується",
    text: "В єгипетських гробницях знаходили горщики з медом 3000-річної давнини — він був їстівним. Мед не псується практично ніколи завдяки низькому вмісту води та антибактеріальним властивостям.",
  },
  {
    emoji: "☕",
    title: "Каву знайшли кози",
    text: "За легендою, у IX ст. ефіопський пастух Калдім помітив, що кози після поїдання певних ягід не сплять вночі. Він спробував їх сам і відчув прилив енергії — так людство відкрило каву.",
  },
  {
    emoji: "🫙",
    title: "Кетчуп продавали в аптеці",
    text: "У 1830-х роках американські лікарі прописували томатний кетчуп як ліки від розладів шлунку. Він продавався в аптеках у вигляді таблеток аж до 1850-х років.",
  },
  {
    emoji: "🌽",
    title: "Кукурудза — штучна рослина",
    text: "Кукурудза була виведена 9000 років тому в Мексиці з дикої трави теосинте. Вона не може розмножитись без людини — качан занадто щільний, щоб насіння саме впало на землю.",
  },
];

let fallbackIndex = 0;

async function generateFoodFact(usedTitles = []) {
  if (!GEMINI_API_KEY) {
    return getFallbackFact();
  }

  const usedList =
    usedTitles.length > 0
      ? `\n\nВже використані теми (не повторювати): ${usedTitles.slice(-30).join(", ")}`
      : "";

  const prompt = `Ти — експерт з кулінарної історії. Напиши один цікавий факт про їжу, кулінарію або походження страви українською мовою.${usedList}

Вимоги:
- Факт має бути реальним та перевіреним
- Довжина тексту: 2-3 речення (не більше 280 символів)
- Захопливий заголовок (до 50 символів)
- Підбери відповідний emoji

Відповідай ТІЛЬКИ у форматі JSON (без markdown, без коментарів):
{"emoji":"🍕","title":"Заголовок факту","text":"Текст факту."}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return getFallbackFact();
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error("Gemini: no JSON in response");
      return getFallbackFact();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.emoji || !parsed.title || !parsed.text) {
      return getFallbackFact();
    }

    console.log(`Gemini fact generated: ${parsed.title}`);
    return parsed;
  } catch (error) {
    console.error("Gemini generation error:", error);
    return getFallbackFact();
  }
}

function getFallbackFact() {
  const fact = FALLBACK_FACTS[fallbackIndex % FALLBACK_FACTS.length];
  fallbackIndex++;
  return fact;
}

module.exports = { generateFoodFact };
