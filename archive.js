
"use strict";

// --------------------------------------------------
// 1. Configuration
// --------------------------------------------------

const INDEX_URL = "data/forecasts.json";

const ARCHIVE_BASE_URL =
  "https://raw.githubusercontent.com/" +
  "jeremyash/southern-area-forecast-cache/" +
  "cache-data/text-archive/";

// --------------------------------------------------
// 2. Elements and state
// --------------------------------------------------

const projectSearch = document.getElementById("project-search");
const forestFilter = document.getElementById("forest-filter");
const dateFilter = document.getElementById("date-filter");
const clearFilters = document.getElementById("clear-filters");

const resultCount = document.getElementById("result-count");
const forecastResults = document.getElementById("forecast-results");

const viewer = document.getElementById("forecast-viewer");
const viewerTitle = document.getElementById("viewer-title");
const viewerMeta = document.getElementById("viewer-meta");
const forecastText = document.getElementById("forecast-text");
const downloadForecast = document.getElementById("download-forecast");
const closeViewer = document.getElementById("close-viewer");

let forecasts = [];
let selectedForecast = null;
let viewerRequest = 0;

// --------------------------------------------------
// 3. Helpers
// --------------------------------------------------

function formatDate(dateString) {
  if (!dateString) return "Unknown date";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function makeTextUrl(archiveFile) {
  const parts = String(archiveFile || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);

  if (
    parts.length !== 2 ||
    parts.some(part => part === "." || part === "..") ||
    !parts[1].toLowerCase().endsWith(".txt")
  ) {
    throw new Error("Invalid archive file path.");
  }

  return ARCHIVE_BASE_URL +
    parts.map(encodeURIComponent).join("/");
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// --------------------------------------------------
// 4. Populate forest dropdown
// --------------------------------------------------

function populateForests() {
  const forests = [...new Set(
    forecasts.map(item => item.forest).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  forestFilter.replaceChildren(
    new Option("All Forests", "")
  );

  for (const forest of forests) {
    forestFilter.add(new Option(forest, forest));
  }
}

// --------------------------------------------------
// 5. Filter and display forecasts
// --------------------------------------------------

function getFilteredForecasts() {
  const search = projectSearch.value.trim().toLowerCase();
  const forest = forestFilter.value;
  const date = dateFilter.value;

  return forecasts.filter(item => {
    const matchesProject = String(item.project_name || "")
      .toLowerCase()
      .includes(search);

    const matchesForest =
      !forest || item.forest === forest;

    const matchesDate =
      !date || item.issuance_date === date;

    return matchesProject && matchesForest && matchesDate;
  });
}

function renderResults() {
  const filtered = getFilteredForecasts();

  resultCount.textContent =
    `${filtered.length.toLocaleString()} forecasts`;

  forecastResults.replaceChildren();

  if (filtered.length === 0) {
    forecastResults.appendChild(
      makeElement(
        "p",
        "empty-message",
        "No forecasts match the selected filters."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of filtered.slice(0, 100)) {
    const card = makeElement("article", "forecast-card");

    card.appendChild(
      makeElement(
        "h3",
        "",
        item.project_name || "Unnamed Project"
      )
    );

    card.appendChild(
      makeElement(
        "p",
        "",
        item.forest || "Unknown Forest"
      )
    );

    card.appendChild(
      makeElement(
        "p",
        "",
        formatDate(item.issuance_date) +
          (item.issuance_time_local
            ? ` · ${item.issuance_time_local}`
            : "")
      )
    );

    if (item.spot_id) {
      card.appendChild(
        makeElement("p", "", `Spot ID: ${item.spot_id}`)
      );
    }

    const button = makeElement(
      "button",
      "",
      "View Forecast →"
    );

    button.type = "button";
    button.addEventListener("click", () => openForecast(item));

    card.appendChild(button);
    fragment.appendChild(card);
  }

  forecastResults.appendChild(fragment);

  if (filtered.length > 100) {
    forecastResults.appendChild(
      makeElement(
        "p",
        "empty-message",
        `Showing the first 100 of ${filtered.length.toLocaleString()} forecasts. Refine your search to see more.`
      )
    );
  }
}

// --------------------------------------------------
// 6. Open and close forecast viewer
// --------------------------------------------------

async function openForecast(item) {
  const requestId = ++viewerRequest;
  selectedForecast = item;

  viewerTitle.textContent =
    item.project_name || "Unnamed Project";

  viewerMeta.textContent = [
    item.forest,
    item.issuance_time_local || formatDate(item.issuance_date),
    item.spot_id ? `Spot ID: ${item.spot_id}` : ""
  ].filter(Boolean).join(" · ");

  forecastText.textContent = "Loading forecast...";

  let url;

  try {
    url = makeTextUrl(item.archive_file);
  } catch (error) {
    forecastText.textContent =
      "This forecast has an invalid archive file path.";
    downloadForecast.removeAttribute("href");
    viewer.hidden = false;
    viewer.scrollIntoView({ behavior: "smooth" });
    return;
  }

  downloadForecast.href = url;

  viewer.hidden = false;
  viewer.scrollIntoView({ behavior: "smooth" });

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    // Ignore older requests if another forecast was selected.
    if (requestId !== viewerRequest) return;

    forecastText.textContent = text;

  } catch (error) {
    if (requestId !== viewerRequest) return;

    forecastText.textContent =
      "Unable to load this forecast. " +
      "Use 'Open Original Text' to view it directly.";
  }
}

function hideViewer() {
  ++viewerRequest;
  selectedForecast = null;
  viewer.hidden = true;
  forecastText.textContent = "";
}

// --------------------------------------------------
// 7. Load forecast index
// --------------------------------------------------

async function loadForecasts() {
  resultCount.textContent = "Loading forecasts...";

  try {
    const response = await fetch(INDEX_URL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid forecast index.");
    }

    forecasts = data
      .filter(item => item && item.archive_file)
      .sort((a, b) =>
        String(b.issuance_time_utc || b.issuance_date || "")
          .localeCompare(
            String(a.issuance_time_utc || a.issuance_date || "")
          )
      );

    populateForests();
    renderResults();

  } catch (error) {
    console.error("Failed to load forecast archive:", error);

    resultCount.textContent = "Archive unavailable";

    forecastResults.replaceChildren(
      makeElement(
        "p",
        "empty-message",
        "Unable to load archived forecasts. Please try again later."
      )
    );
  }
}

// --------------------------------------------------
// 8. Event listeners
// --------------------------------------------------

projectSearch.addEventListener("input", renderResults);
forestFilter.addEventListener("change", renderResults);
dateFilter.addEventListener("change", renderResults);

clearFilters.addEventListener("click", () => {
  projectSearch.value = "";
  forestFilter.value = "";
  dateFilter.value = "";

  hideViewer();
  renderResults();
});

closeViewer.addEventListener("click", hideViewer);

// --------------------------------------------------
// 9. Initialize
// --------------------------------------------------

loadForecasts();
