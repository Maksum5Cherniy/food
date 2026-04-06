# Food Recipes Site

Адаптивний сайт рецептів з адміністраторською панеллю та серверною синхронізацією.

## Як запускати локально

```powershell
cd "c:\Users\maksu\OneDrive\Робочий стіл\project"
npm install
npm start
```

Потім відкрий:

```text
http://localhost:8000
```

## Налаштування для Render

1. Підключи репозиторій `https://github.com/Maksum5Cherniy/food`
2. Обери `Web Service`
3. Вкажи:
   - `Branch`: `main`
   - `Build Command`: `npm install`
   - `Start Command`: `npm start`
4. Додай `Persistent Disk`
5. Додай environment variable:
   - `RECIPE_DATA_DIR=/data`

## Як працює збереження рецептів

- На сервері дані зберігаються у `recipes.json`
- Якщо Render монтує диск у `/data`, файл зберігатиметься на Persistent Disk
- Якщо `/data` не заданий, файл зберігатиметься у локальній папці `data`

## Адмінка

- Натисни кнопку `Адмін`
- Введи пароль: `adminfood`
- Додавай, редагуй та видаляй рецепти

## Порада

Якщо хочеш, можу також допомогти налаштувати Render з Persistent Disk по кроках у UI.
