const API_KEY = "a94ab7d726d0c5d3902f74d7";

const ALL_CODES = Object.keys(COUNTRY_NAMES).sort();

const amountInput = document.getElementById("amountInput");
const swapBtn = document.getElementById("swapBtn");
const convertBtn = document.getElementById("convertBtn");
const resultDiv = document.getElementById("resultDiv");
const amountAlert = document.getElementById("amountAlert");
const apiAlert = document.getElementById("apiAlert");

const state = {
  from: "AED",
  to: "AED",
  rates: null,
};

async function fetchRates(baseCode) {
  const response = await fetch(
    `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCode}`
  );

  if (!response.ok) {
    throw new Error("Failed to reach the exchange rate service");
  }

  const data = await response.json();

  if (data.result !== "success" || !data.conversion_rates) {
    throw new Error(data["error-type"] || "Invalid response from the API");
  }

  return data.conversion_rates;
}

function flagMarkup(code) {
  const src = `https://flagsapi.com/${getFlagCode(code)}/shiny/32.png`;
  return `<img src="${src}" alt="${code}" class="picker-flag" data-code="${code}" />`;
}

function bindFlagFallback(scope) {
  scope.querySelectorAll("img.picker-flag").forEach((img) => {
    img.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.className = "flag-fallback";
      fallback.textContent = img.dataset.code;
      img.replaceWith(fallback);
    });
  });
}

function showApiAlert(message) {
  apiAlert.querySelector(".alert").textContent = message;
  apiAlert.classList.remove("d-none");
}

function hideApiAlert() {
  apiAlert.classList.add("d-none");
}

function showAmountAlert() {
  amountAlert.classList.remove("d-none");
}

function hideAmountAlert() {
  amountAlert.classList.add("d-none");
}

const pickers = {};

function createPicker(containerId, side) {
  const root = document.getElementById(containerId);

  root.innerHTML = `
    <button type="button" class="picker-toggle"></button>
    <div class="picker-panel">
      <input type="text" class="picker-search"
        placeholder="Search country or currency..." />
      <ul class="picker-list"></ul>
    </div>`;

  const toggle = root.querySelector(".picker-toggle");
  const search = root.querySelector(".picker-search");
  const list = root.querySelector(".picker-list");

  const currentCode = () => (side === "from" ? state.from : state.to);

  function renderToggle() {
    const code = currentCode();
    toggle.innerHTML = `
      ${flagMarkup(code)}
      <span><span class="code">${code}</span> || ${COUNTRY_NAMES[code] || code}</span>
      <i class="fa-solid fa-chevron-down"></i>`;
    bindFlagFallback(toggle);
  }

  function renderList(query = "") {
    const q = query.trim().toLowerCase();
    const selected = currentCode();

    const matches = ALL_CODES.filter((code) => {
      if (state.rates && !(code in state.rates)) return false;
      if (!q) return true;
      return (
        code.toLowerCase().includes(q) ||
        (COUNTRY_NAMES[code] || "").toLowerCase().includes(q)
      );
    });

    if (matches.length === 0) {
      list.innerHTML = `<li class="picker-empty">No matches found</li>`;
      return;
    }

    list.innerHTML = matches
      .map(
        (code) => `
      <li data-code="${code}" class="${code === selected ? "selected" : ""}">
        ${flagMarkup(code)}
        <span class="code">${code}</span>
        <span>${COUNTRY_NAMES[code] || code}</span>
      </li>`
      )
      .join("");

    bindFlagFallback(list);
  }

  function open() {
    document
      .querySelectorAll(".currency-picker.open")
      .forEach((el) => el.classList.remove("open"));
    root.classList.add("open");
    search.value = "";
    renderList();
    search.focus();
  }

  function close() {
    root.classList.remove("open");
  }

  toggle.addEventListener("click", () => {
    root.classList.contains("open") ? close() : open();
  });

  search.addEventListener("input", () => renderList(search.value));

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Enter") {
      const first = list.querySelector("li[data-code]");
      if (first) first.click();
    }
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest("li[data-code]");
    if (!item) return;

    if (side === "from") state.from = item.dataset.code;
    else state.to = item.dataset.code;

    renderToggle();
    close();
    hideApiAlert();
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) close();
  });

  renderToggle();
  renderList();

  pickers[side] = { renderToggle };
}

function renderResult(fromAmount, fromCode, toAmount, toCode) {
  resultDiv.innerHTML = `
    <span class="me-2 fs-2">${fromAmount}</span>
    <span class="me-2 fs-2">${fromCode}</span>
    <span class="me-2 fs-2">=</span>
    <span class="me-2 fs-2 amount-to">${toAmount}</span>
    <span class="fs-2">${toCode}</span>`;
}

async function handleConvert() {
  const trimmed = amountInput.value.trim();
  const amount = trimmed === "" ? 1 : Number(trimmed);

  if (trimmed !== "" && (!Number.isFinite(amount) || amount <= 0)) {
    showAmountAlert();
    return;
  }

  hideAmountAlert();
  hideApiAlert();
  convertBtn.disabled = true;
  convertBtn.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status"></span>Converting...`;

  try {
    const rates = await fetchRates(state.from);
    state.rates = rates;

    const rate = rates[state.to];
    if (rate === undefined) {
      showApiAlert(`Rate for ${state.to} is not available right now.`);
      return;
    }

    const converted = +(amount * Number(rate.toFixed(2))).toFixed(2);
    renderResult(amount, state.from, converted, state.to);
    amountInput.value = "";
  } catch (err) {
    showApiAlert(err.message || "Conversion failed. Please try again.");
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert";
  }
}

convertBtn.addEventListener("click", handleConvert);

amountInput.addEventListener("input", hideAmountAlert);

swapBtn.addEventListener("click", () => {
  const temp = state.from;
  state.from = state.to;
  state.to = temp;

  pickers.from.renderToggle();
  pickers.to.renderToggle();
  hideApiAlert();
});

createPicker("fromPicker", "from");
createPicker("toPicker", "to");

(async function init() {
  try {
    state.rates = await fetchRates("AED");
    renderResult(1, "AED", 1, "AED");
  } catch (err) {
    showApiAlert(err.message || "Could not load exchange rates.");
    renderResult(1, "AED", 1, "AED");
  }
})();
