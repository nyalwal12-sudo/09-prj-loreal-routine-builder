/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const CLOUDFLARE_WORKER_URL = "https://gcathing.manyal01.workers.dev";
const STORAGE_KEY = "selectedLorealProductIds";

let allProducts = [];
const selectedProductIds = new Set();
const conversationMessages = [];

/* Show initial placeholder until user starts chatting */
chatWindow.innerHTML = `
  <div class="placeholder-message">
    Ask a question or generate a routine using the selected products.
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

function saveSelectedProductsToStorage() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(Array.from(selectedProductIds)),
  );
}

function loadSavedSelections() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const savedIds = JSON.parse(saved);
    savedIds.forEach((id) => {
      const productId = Number(id);
      if (!Number.isNaN(productId)) {
        selectedProductIds.add(productId);
      }
    });
  } catch (error) {
    console.warn("Could not restore selected products:", error);
  }
}

async function init() {
  await loadProducts();
  loadSavedSelections();
  updateSelectedProductsList();
  updateChatWindow();
}

/* Create a system prompt that includes the selected products if any */
function createSystemMessage(selectedProducts) {
  if (selectedProducts.length === 0) {
    return {
      role: "system",
      content:
        "You are a professional beauty routine advisor for L'Oréal. Provide helpful, respectful guidance in complete short answers. Do not use '*' or '#' in any response. Use plain text with short sentences and line breaks, and avoid markdown formatting. Refer back to earlier messages so the conversation stays coherent.",
    };
  }

  const productList = selectedProducts
    .map(
      (product, index) =>
        `${index + 1}. ${product.name} by ${product.brand} (${product.category}) - ${product.description}`,
    )
    .join("\n");

  return {
    role: "system",
    content: `You are a professional beauty routine advisor for L'Oréal. Use the selected products below to answer questions and build routines. Keep your responses short, complete, and easy to read without markdown characters. Do not use '*' or '#' in any response. Use plain text and line breaks only.\n\nSelected products:\n${productList}`,
  };
}

/* Render the selected products list above the button */
function updateSelectedProductsList() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="no-selection">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product-item" data-product-id="${product.id}">
        ${product.name}
      </div>
    `,
    )
    .join("");
}

/* Toggle product selection when a card is clicked */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  updateSelectedProductsList();
  saveSelectedProductsToStorage();
}

/* Add click event listeners to product cards after rendering */
function attachProductCardEvents() {
  const cards = document.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const productId = Number(card.dataset.productId);
    card.addEventListener("click", () => {
      card.classList.toggle("selected");
      toggleProductSelection(productId);
    });
  });
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      selectedProductIds.has(product.id) ? "selected" : ""
    }" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <p class="product-description">${product.description}</p>
      </div>
    </div>
  `,
    )
    .join("");

  attachProductCardEvents();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
  updateSelectedProductsList();
});

function formatChatText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function isRTL(text) {
  return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
}

function renderChatMessage(role, text) {
  const roleClass = role === "user" ? "user" : "assistant";
  const directionClass = isRTL(text) ? "rtl" : "ltr";
  const roleLabel = role === "user" ? "You" : "L'Oréal Advisor";

  return `
    <div class="chat-message ${roleClass} ${directionClass}">
      <div class="chat-message-label">${roleLabel}</div>
      <div class="chat-message-text">${formatChatText(text)}</div>
    </div>
  `;
}

function updateChatWindow() {
  if (conversationMessages.length === 0) {
    chatWindow.innerHTML = `
      <div class="placeholder-message">
        Ask a question or generate a routine using the selected products.
      </div>
    `;
    return;
  }

  chatWindow.innerHTML = conversationMessages
    .map((message) => renderChatMessage(message.role, message.content))
    .join("");

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sanitizeAssistantText(text) {
  return text.replace(/[*#]/g, "").replace(/\r/g, "").trim();
}

function addChatMessage(role, content) {
  const finalContent =
    role === "assistant" ? sanitizeAssistantText(content) : content;
  conversationMessages.push({ role, content: finalContent });
  updateChatWindow();
}

function replaceLastAssistantMessage(content) {
  const sanitized = sanitizeAssistantText(content);

  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    if (conversationMessages[i].role === "assistant") {
      conversationMessages[i].content = sanitized;
      updateChatWindow();
      return;
    }
  }

  addChatMessage("assistant", sanitized);
}

function getSelectedProducts() {
  return allProducts.filter((product) => selectedProductIds.has(product.id));
}

async function sendOpenAIRequest(messages) {
  const response = await fetch(CLOUDFLARE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return (
    data.choices?.[0]?.message?.content ||
    "Sorry, I could not generate a response right now."
  );
}

async function handleGenerateRoutine() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    addChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const userPrompt =
    "Generate a short, complete personalized routine using the selected products.";
  addChatMessage("user", userPrompt);
  addChatMessage("assistant", "Generating your routine...");

  const systemMessage = createSystemMessage(selectedProducts);
  const messages = [systemMessage, ...conversationMessages];

  try {
    const routine = await sendOpenAIRequest(messages);
    replaceLastAssistantMessage(routine);
  } catch (error) {
    replaceLastAssistantMessage(
      "Sorry, something went wrong while generating the routine.",
    );
  }
}

generateRoutineBtn.addEventListener("click", handleGenerateRoutine);

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const prompt = userInput.value.trim();
  if (!prompt) return;

  addChatMessage("user", prompt);
  addChatMessage("assistant", "Thinking... connecting to OpenAI...");
  userInput.value = "";

  const selectedProducts = getSelectedProducts();
  const systemMessage = createSystemMessage(selectedProducts);
  const messages = [systemMessage, ...conversationMessages];

  try {
    const responseText = await sendOpenAIRequest(messages);
    replaceLastAssistantMessage(responseText);
  } catch (error) {
    replaceLastAssistantMessage(
      "Sorry, something went wrong while connecting to the assistant.",
    );
  }
});

/* initialize the product list cache */
init();
