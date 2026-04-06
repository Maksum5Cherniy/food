const ADMIN_PASSWORD = "adminfood";
const STORAGE_KEY = "recipeSiteContent";
const defaultRecipes = [
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
  {
    id: "pasca",
    title: "Традиційна паска",
    description:
      "Опис: Інгредієнти Тісто: Борошно пшеничне – 1100 г / 7 склянок ( варто коригувати кількість борошна у процесі приготування, оскільки у кожного борошна свої поглинаючі властивості) «Львівські дріжджі» пресовані – 80 г Цукор – 250 г Сіль – 1 ч. л. Масло – 250 г Яйця – 4 шт. + 1 жовток (яйця середнього розміру) Молоко – 300-350 г Родзинки – 250-300 г Ванільний цукор – 1 пакет / 10 г Коньяк – 50 г Цедра лимона або апельсина – 10 г Білкова глазур: Білок 1 шт Цукрова пудра 120-150 г Лимонний сік 1 ст л Декор за смаком Яйце для змащування",
    time: "180 хв",
    image:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80",
  },
];

const recipeList = document.getElementById("recipeList");
const adminToggle = document.getElementById("adminToggle");
const adminDialog = document.getElementById("adminDialog");
const adminForm = document.getElementById("adminForm");
const adminPassword = document.getElementById("adminPassword");
const adminClose = document.getElementById("adminClose");
const editorArea = document.getElementById("editorArea");
const adminRecipeList = document.getElementById("adminRecipeList");
const adminLogout = document.getElementById("adminLogout");
const recipeTitle = document.getElementById("recipeTitle");
const recipeDescription = document.getElementById("recipeDescription");
const recipeTime = document.getElementById("recipeTime");
const recipeImage = document.getElementById("recipeImage");
const saveRecipe = document.getElementById("saveRecipe");
const clearRecipe = document.getElementById("clearRecipe");
const recipeImagePreview = document.getElementById("recipeImagePreview");
const API_BASE = "/api/recipes";

let recipes = [];
let editingId = null;
let isAdmin = false;
let serverOnline = false;

async function loadRecipes() {
  try {
    const response = await fetch(API_BASE, { cache: "no-cache" });
    if (response.ok) {
      const serverRecipes = await response.json();
      if (Array.isArray(serverRecipes)) {
        serverOnline = true;
        saveRecipes(serverRecipes);
        return serverRecipes;
      }
    }
  } catch (error) {
    console.warn("Не вдалося завантажити рецепти з сервера", error);
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Не вдалося завантажити збережені дані", error);
  }

  return defaultRecipes;
}

function saveRecipes(data = recipes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function createRecipeOnServer(recipe) {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });
  if (!response.ok) {
    throw new Error("Не вдалося створити рецепт на сервері");
  }
  return response.json();
}

async function updateRecipeOnServer(recipe) {
  const response = await fetch(`${API_BASE}/${recipe.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });
  if (!response.ok) {
    throw new Error("Не вдалося оновити рецепт на сервері");
  }
  return response.json();
}

async function deleteRecipeOnServer(id) {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return response.ok;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDescription(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 100) {
    return trimmed;
  }
  return trimmed.slice(0, 100).replace(/\s+$/, "") + "...";
}

function formatDescriptionHTML(text) {
  if (!text) return "";
  const normalized = text.trim().replace(/^Опис:\s*/i, "");
  const lines = normalized.split("\n").map((l) => l.trim());

  const HEADER_RE =
    /^(Інгредієнти|Тісто|Начинка|Соус|Глазур|Декор|Крем|Приготування|Спосіб приготування)[:.]?\s*$/i;

  let html = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    if (HEADER_RE.test(line)) {
      html += `<p class="recipe-section-title">${escapeHtml(line.replace(/[:.]$/, ""))}</p>`;
      i++;
    } else if (/^\d+[.)]\s/.test(line)) {
      html += '<ol class="recipe-steps">';
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        html += `<li>${escapeHtml(lines[i].replace(/^\d+[.)]\s/, ""))}</li>`;
        i++;
      }
      html += "</ol>";
    } else if (/^[-•–]\s/.test(line)) {
      html += '<ul class="recipe-ingredients">';
      while (i < lines.length && lines[i] && /^[-•–]\s/.test(lines[i])) {
        html += `<li>${escapeHtml(lines[i].replace(/^[-•–]\s/, ""))}</li>`;
        i++;
      }
      html += "</ul>";
    } else {
      html += `<p>${escapeHtml(line)}</p>`;
      i++;
    }
  }
  return html;
}

function renderRecipes() {
  recipeList.innerHTML = "";
  recipes.forEach((recipe) => {
    const card = document.createElement("article");
    card.className = "recipe-card";
    card.id = recipe.id;

    const image = document.createElement("img");
    image.src = recipe.image;
    image.alt = recipe.title;
    image.loading = "lazy";

    const content = document.createElement("div");
    content.className = "recipe-card-body";
    const title = document.createElement("h4");
    title.textContent = recipe.title;

    const summary = document.createElement("p");
    summary.className = "recipe-description-summary";
    summary.innerHTML = `<strong>Опис:</strong> ${escapeHtml(formatDescription(recipe.description))}`;

    content.append(title, summary);

    const fullDescription = document.createElement("div");
    fullDescription.className = "recipe-description-full hidden";
    fullDescription.innerHTML = formatDescriptionHTML(recipe.description);
    content.appendChild(fullDescription);

    let toggleButton = null;
    if (recipe.description.trim().length > 100) {
      toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "button button-secondary toggle-description";
      toggleButton.dataset.action = "toggle-description";
      toggleButton.textContent = "Показати більше";
      content.appendChild(toggleButton);
    }

    const meta = document.createElement("div");
    meta.className = "recipe-meta";
    meta.innerHTML = `<span>Час: ${escapeHtml(recipe.time)}</span>`;

    card.append(image, content, meta);
    recipeList.appendChild(card);
  });
}

function openAdminDialog() {
  adminDialog.showModal();
  adminForm.classList.remove("hidden");
  editorArea.classList.add("hidden");
  adminPassword.value = "";
  adminPassword.focus();
}

function closeAdminDialog() {
  adminDialog.close();
}

function enterAdminMode() {
  isAdmin = true;
  sessionStorage.setItem("recipeAdminMode", "true");
  adminForm.classList.add("hidden");
  editorArea.classList.remove("hidden");
  renderAdminList();
}

function leaveAdminMode() {
  isAdmin = false;
  sessionStorage.removeItem("recipeAdminMode");
  closeAdminDialog();
}

function renderAdminList() {
  adminRecipeList.innerHTML = "";
  recipes.forEach((recipe) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${recipe.title}</span>
      <span>
        <button class="button button-secondary" type="button" data-action="edit" data-id="${recipe.id}">Редагувати</button>
        <button class="button button-secondary" type="button" data-action="delete" data-id="${recipe.id}">Видалити</button>
      </span>
    `;
    adminRecipeList.appendChild(item);
  });
}

function fillEditor(recipe) {
  recipeTitle.value = recipe.title;
  recipeDescription.value = recipe.description;
  recipeTime.value = recipe.time;
  recipeImage.value = "";
  showImagePreview(recipe.image);
  editingId = recipe.id;
}

function resetEditor() {
  recipeTitle.value = "";
  recipeDescription.value = "";
  recipeTime.value = "";
  recipeImage.value = "";
  showImagePreview("");
  editingId = null;
}

function showImagePreview(src) {
  recipeImagePreview.innerHTML = "";
  if (!src) {
    recipeImagePreview.classList.add("hidden");
    return;
  }
  recipeImagePreview.innerHTML = `<img src="${src}" alt="Попередній перегляд фото рецепту" />`;
  recipeImagePreview.classList.remove("hidden");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function saveCurrentRecipe() {
  const title = recipeTitle.value.trim();
  const description = recipeDescription.value.trim();
  const time = recipeTime.value.trim();
  if (!title || !description || !time) {
    alert("Будь ласка, заповніть назву, опис та час приготування.");
    return;
  }

  let image = null;
  if (recipeImage.files && recipeImage.files.length > 0) {
    const file = recipeImage.files[0];
    if (file.type.startsWith("image/")) {
      image = await readImageFile(file);
    }
  }

  if (!image) {
    if (editingId) {
      const existingRecipe = recipes.find((recipe) => recipe.id === editingId);
      image =
        existingRecipe?.image ||
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80";
    } else {
      image =
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80";
    }
  }

  const payload = { title, description, time, image };
  try {
    if (editingId) {
      const updatedRecipe = await updateRecipeOnServer({
        id: editingId,
        ...payload,
      });
      recipes = recipes.map((recipe) =>
        recipe.id === editingId ? updatedRecipe : recipe,
      );
    } else {
      const createdRecipe = await createRecipeOnServer(payload);
      recipes.push(createdRecipe);
    }
    serverOnline = true;
    saveRecipes(recipes);
    renderRecipes();
    renderAdminList();
    resetEditor();
  } catch (error) {
    console.error("Помилка збереження:", error);
    alert(
      "Не вдалося зберегти рецепт. Сервер не відповідає — зачекайте кілька секунд і спробуйте ще раз.",
    );
  }
}

recipeList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "toggle-description") {
    const card = button.closest(".recipe-card");
    const summary = card.querySelector(".recipe-description-summary");
    const fullDescription = card.querySelector(".recipe-description-full");
    if (!summary || !fullDescription) return;

    const isExpanded = fullDescription.classList.contains("hidden") === false;
    if (isExpanded) {
      fullDescription.classList.add("hidden");
      summary.classList.remove("hidden");
      button.textContent = "Показати більше";
    } else {
      fullDescription.classList.remove("hidden");
      summary.classList.add("hidden");
      button.textContent = "Згорнути";
    }
    return;
  }

  if (!isAdmin) return;
});

adminToggle.addEventListener("click", openAdminDialog);
adminClose.addEventListener("click", closeAdminDialog);
adminDialog.addEventListener("click", (event) => {
  if (event.target === adminDialog) {
    closeAdminDialog();
  }
});

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = document.getElementById("adminPassword").value;
  if (value === ADMIN_PASSWORD) {
    enterAdminMode();
  } else {
    alert("Невірний пароль адміністратора.");
  }
});

adminRecipeList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  const targetRecipe = recipes.find((recipe) => recipe.id === id);
  if (!targetRecipe) return;

  if (action === "edit") {
    fillEditor(targetRecipe);
  }
  if (action === "delete") {
    if (confirm(`Видалити рецепт «${targetRecipe.title}»?`)) {
      if (serverOnline) {
        try {
          const deleted = await deleteRecipeOnServer(id);
          if (!deleted) {
            alert("Не вдалося видалити рецепт на сервері.");
            return;
          }
        } catch (error) {
          console.warn("Не вдалося видалити рецепт на сервері", error);
          serverOnline = false;
        }
      }
      recipes = recipes.filter((recipe) => recipe.id !== id);
      saveRecipes(recipes);
      renderRecipes();
      renderAdminList();
    }
  }
});

recipeImage.addEventListener("change", async () => {
  if (recipeImage.files && recipeImage.files.length > 0) {
    const file = recipeImage.files[0];
    if (file.type.startsWith("image/")) {
      const preview = await readImageFile(file);
      showImagePreview(preview);
    } else {
      showImagePreview("");
    }
  } else {
    showImagePreview("");
  }
});

saveRecipe.addEventListener("click", saveCurrentRecipe);
clearRecipe.addEventListener("click", resetEditor);
adminLogout.addEventListener("click", leaveAdminMode);

function restoreAdminState() {
  if (sessionStorage.getItem("recipeAdminMode") === "true") {
    openAdminDialog();
    enterAdminMode();
  }
}

window.addEventListener("load", async () => {
  recipes = await loadRecipes();
  renderRecipes();
  restoreAdminState();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Помилка реєстрації service worker:", error);
    });
  }
});
