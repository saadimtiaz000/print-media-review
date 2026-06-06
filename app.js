const fallbackData = {
  date: "22 May 2026",
  readTime: "Approx reading time: 6 minutes",
  fetchWindow: "Fetch window: latest source pages",
  fetchedAt: "Sample data",
  sections: [
    {
      source: "Dawn",
      status: "sample",
      scores: {
        State: 3.5,
        Opposition: 2.5,
        Reform: 3.5,
        Security: 3.5,
        "Civil liberties": 4.0
      },
      items: [
        {
          title: "Hardening lines",
          author: "Editorial",
          theme: "Security",
          tone: "positive",
          summary:
            "warns US-Iran talks remain fragile as Tehran distrusts Pakistan's US-Gulf links; guarded facilitation, not breakthrough, is the line."
        },
        {
          title: "Unliveable city",
          author: "Editorial",
          theme: "Reform",
          summary:
            "frames Karachi's water shortage as daily survival failure; civic governance and service delivery dominate over elite politics."
        },
        {
          title: "Glof alert",
          author: "Editorial",
          theme: "Security",
          summary:
            "treats northern climate hazards as immediate security risk; adaptation and early warning are presented as governance obligations."
        },
        {
          title: "Reconsidering assessments",
          author: "Faisal Bari",
          theme: "Reform",
          summary:
            "challenges high-stakes exams for reproducing class inequality; education access, not marks alone, should shape progression."
        },
        {
          title: "World and religion",
          author: "Sadiq Karim Soofi",
          theme: "Civil liberties",
          summary:
            "revisits faith as moral orientation, pushing religious reflection away from slogans toward purpose and social ethics."
        },
        {
          title: "Death of intellect?",
          author: "Aasim Sajjad Akhtar",
          theme: "Civil liberties",
          summary:
            "warns anti-intellectual politics and criminalised dissent hollow public life; strong civil-liberties and democratic-culture line."
        }
      ]
    },
    {
      source: "The Express Tribune",
      status: "sample",
      scores: {
        State: 4.0,
        Opposition: 2.5,
        Reform: 4.0,
        Security: 4.0,
        "Civil liberties": 3.0
      },
      items: [
        {
          title: "Additional taxes",
          author: "Editorial",
          theme: "Reform",
          summary:
            "demands broader taxation beyond salaried citizens and fuel levies; fiscal reform is framed as fairness and political courage."
        },
        {
          title: "Illegal kidney trade",
          author: "Editorial",
          theme: "Civil liberties",
          summary:
            "links organ trafficking to poverty, bonded labour and weak enforcement; rights critique is tied to prosecution and poverty relief."
        },
        {
          title: "Climate vulnerability",
          author: "Editorial",
          theme: "Security",
          tone: "positive",
          summary:
            "casts climate shocks as an economic emergency, demanding resilience inside planning rather than environmental paperwork."
        },
        {
          title: "The ongoing reordering of aid priorities",
          author: "Syed Mohammad Ali",
          theme: "Reform",
          summary:
            "warns shrinking Western aid makes domestic revenue, climate resilience and fiscal transparency urgent."
        },
        {
          title: "Dividends of the Iran war",
          author: "Shahzad Chaudhry",
          theme: "Security",
          summary:
            "argues Iran survived by making US coercion costly; middle-power resilience and geography shape the lesson."
        },
        {
          title: "Let's begin with Somaliland",
          author: "Aneela Shahzad",
          theme: "Opposition",
          summary:
            "uses recognition politics to critique Western-backed fragmentation and strategic opportunism around the Red Sea."
        }
      ]
    }
  ]
};

const sourceConfigs = [
  {
    source: "Dawn",
    urlsForDate: () => [
      "https://www.dawn.com/newspaper/column",
      "https://www.dawn.com/newspaper/editorial"
    ],
    urlAllow: /dawn\.com\/news\/\d+/i,
    selectors: {
      titles: "h2 a, h3 a",
      authorLinks: "a[href*='/authors/']"
    }
  },
  {
    source: "The Express Tribune",
    urlsForDate: (dateIso) => [`https://tribune.com.pk/listing/opinion/${dateIso}`],
    assumeUrlDate: true,
    urlAllow: /tribune\.com\.pk\/story\/\d+/i,
    selectors: {
      titles: "h2 a, h3 a, h4 a, article a",
      authorLinks: "a[href*='/author/']"
    }
  }
];

let reportData = structuredClone(fallbackData);
let isFetching = false;

const sourceFilter = document.querySelector("#sourceFilter");
const themeFilter = document.querySelector("#themeFilter");
const searchInput = document.querySelector("#searchInput");
const reportDateInput = document.querySelector("#reportDateInput");
const reviewSections = document.querySelector("#reviewSections");
const scoreBars = document.querySelector("#scoreBars");
const sourceStatus = document.querySelector("#sourceStatus");
const sourceCount = document.querySelector("#sourceCount");
const reportStatus = document.querySelector("#reportStatus");

const scoreNames = ["State", "Opposition", "Reform", "Security", "Civil liberties"];
const themeKeywords = {
  State: ["state", "government", "policy", "federal", "province", "china", "diplomacy", "economy", "budget"],
  Opposition: ["opposition", "pti", "pml", "ppp", "election", "parliament", "party", "political"],
  Reform: ["reform", "tax", "education", "health", "governance", "water", "energy", "schools", "courts", "system"],
  Security: ["security", "terror", "border", "iran", "afghan", "gaza", "war", "climate", "maritime", "police"],
  "Civil liberties": ["rights", "liberty", "justice", "women", "children", "minority", "freedom", "speech", "dissent"]
};

function formatScore(value) {
  return Number(value).toFixed(1);
}

function formatToday() {
  return formatDisplayDate(todayIso());
}

function todayIso() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
}

function formatDisplayDate(dateIso) {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatFetchTime() {
  return `Fetched: ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(new Date())}`;
}

function selectedReportDate() {
  return reportDateInput.value || todayIso();
}

const months = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12"
};

function dateIsoFromText(text, fallbackIso = "") {
  const value = cleanText(text);
  const dayFirst = value.match(/\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b/);
  if (dayFirst) {
    const month = months[dayFirst[2].toLowerCase()];
    if (month) {
      return `${dayFirst[3]}-${month}-${String(dayFirst[1]).padStart(2, "0")}`;
    }
  }

  const monthFirst = value.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (monthFirst) {
    const month = months[monthFirst[1].toLowerCase()];
    if (month) {
      return `${monthFirst[3]}-${month}-${String(monthFirst[2]).padStart(2, "0")}`;
    }
  }

  if (fallbackIso && /\b(updated\s+)?(\d+\s+)?(minutes?|hours?)\s+ago\b|today/i.test(value)) {
    return fallbackIso;
  }

  return "";
}

function pageDateFromText(text, targetDateIso, assumeTargetDate = false) {
  const head = text.slice(0, 7000);
  return dateIsoFromText(head) || (assumeTargetDate ? targetDateIso : "");
}

function itemDateFromText(text, pageDateIso, targetDateIso) {
  return dateIsoFromText(text, pageDateIso === targetDateIso ? targetDateIso : "");
}

function cleanText(value) {
  return (value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function sanitizeArticleText(value) {
  return cleanText(value)
    .replace(/^#{1,6}\s*/, "")
    .replace(/^#{1,6}/, "")
    .replace(/\s+#{1,6}\s+/g, " ")
    .replace(/\s+#{1,6}/g, " ")
    .trim();
}

function cleanMarkdownLine(value) {
  return sanitizeArticleText(
    (value || "")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/^[-*]\s*/, "")
      .replace(/\|/g, " ")
  );
}

function stripHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = value || "";
  return cleanText(template.content.textContent || "");
}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return "";
  }
}

function sentenceCase(value) {
  const text = sanitizeArticleText(value);
  if (!text) {
    return "";
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function classifyTheme(text) {
  const haystack = text.toLowerCase();
  const scores = Object.entries(themeKeywords).map(([name, words]) => ({
    name,
    hits: words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
  }));
  scores.sort((a, b) => b.hits - a.hits);
  return scores[0].hits ? scores[0].name : "State";
}

function cleanTitleForSummary(title) {
  return sanitizeArticleText(title)
    .replace(/^[*•\s]+/, "")
    .replace(/\s*[,–-]\s*(Front|Back) Page$/i, "")
    .trim();
}

function buildSummary(title, teaser, theme) {
  const cleanTeaser = sanitizeArticleText(stripHtml(teaser));
  const cleanTitle = cleanTitleForSummary(title) || "the article";

  if (cleanTeaser && cleanTeaser.length > 22 && !isNoisyMarkdownLine(cleanTeaser)) {
    return `${themeLinePrefix(theme)} ${sentenceCase(cleanTeaser)}.`;
  }

  return `${themeLinePrefix(theme)} ${sentenceCase(cleanTitle)}.`;
}

function themeLinePrefix(theme) {
  const prefixes = {
    State: "casts state capacity as the central question; tracks the argument around",
    Opposition: "positions the story under opposition pressure; places it within Pakistan's daily policy debate around",
    Reform: "frames reform as the main test; places the argument around",
    Security: "treats the issue as a security and stability risk; locates the discussion around",
    "Civil liberties": "places rights and civic protections at the centre; grounds the argument around"
  };
  return prefixes[theme] || "frames the discussion as a national governance concern around";
}

function themeFallbackPhrase(theme) {
  const phrases = {
    State: "emphasizing state capacity as the central issue",
    Opposition: "framing coverage through opposition pressure",
    Reform: "treating reform as the key challenge",
    Security: "viewing the story through a security and stability lens",
    "Civil liberties": "emphasizing rights and civic freedoms"
  };
  return phrases[theme] || "framing the discussion as a national governance concern";
}

function toneForItem(theme, text) {
  const lower = text.toLowerCase();
  if (lower.includes("china") || lower.includes("reform") || lower.includes("resilience") || theme === "State") {
    return "positive";
  }
  return "critical";
}

function scoreSection(items) {
  const scores = Object.fromEntries(scoreNames.map((name) => [name, 2.5]));
  items.forEach((item) => {
    scores[item.theme] = Math.min(5, scores[item.theme] + 0.55);
    const text = `${item.title} ${item.summary}`.toLowerCase();
    Object.entries(themeKeywords).forEach(([name, words]) => {
      const hitCount = words.filter((word) => text.includes(word)).length;
      scores[name] = Math.min(5, scores[name] + hitCount * 0.12);
    });
  });
  return Object.fromEntries(scoreNames.map((name) => [name, Math.round(scores[name] * 2) / 2]));
}

function emptyScores() {
  return Object.fromEntries(scoreNames.map((name) => [name, 0]));
}

async function fetchText(url) {
  const readableUrl = `https://r.jina.ai/${url}`;
  const attempts = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    readableUrl
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      if (text.length > 500) {
        return text;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Source unavailable");
}

function extractFromMarkdown(text, config, targetDateIso) {
  const pageDateIso = pageDateFromText(text, targetDateIso, config.assumeUrlDate);
  const rows = text
    .split("\n")
    .map((line) => ({
      raw: cleanText(line),
      text: cleanMarkdownLine(line)
    }))
    .filter((row) => row.text && !isNoisyMarkdownLine(row.text, row.raw));
  const items = [];
  let activeSection = false;

  for (let i = 0; i < rows.length && items.length < 8; i += 1) {
    const row = rows[i];
    const title = sanitizeArticleText(row.text);

    if (isAllowedContentSection(title)) {
      activeSection = true;
      continue;
    }

    if (isStopContentSection(title)) {
      activeSection = false;
      continue;
    }

    if (!activeSection || !isMarkdownTitleRow(row) || !looksLikeTitle(title)) {
      continue;
    }

    const nextRows = rows.slice(i + 1, i + 8).filter((nextRow) => {
      return !isAllowedContentSection(nextRow.text) && !isStopContentSection(nextRow.text);
    });
    const previousAuthor = rows
      .slice(Math.max(0, i - 3), i)
      .map((previousRow) => previousRow.text)
      .reverse()
      .find((line) => looksLikeAuthor(line));
    const authorLine = nextRows.map((nextRow) => nextRow.text).find((line) => looksLikeAuthor(line));
    const dateIso =
      nextRows.map((nextRow) => itemDateFromText(nextRow.text, pageDateIso, targetDateIso)).find(Boolean) ||
      pageDateIso;
    const teaser =
      nextRows
        .map((nextRow) => nextRow.text)
        .find((line) => line.length > 42 && !looksLikeAuthor(line) && !looksLikeTitle(line)) || "";

    items.push(makeItem(title, authorLine || previousAuthor || "Editorial", teaser, "", dateIso));
  }

  return makeSection(config.source, items, "live");
}

function isAllowedContentSection(text) {
  return /^(opinion|editorial|analysis & comment|analysis and comment|more news)$/i.test(text)
    || /^newspaper - (editorial|column|op-ed|opinion)/i.test(text);
}

function isStopContentSection(text) {
  return /^(read more|branded content|cartoon|letters|50 years ago|other voices|sports|business|world|latest|pakistan|follow us)$/i.test(text);
}

function isMarkdownTitleRow(row) {
  return /^#{1,6}\s*/.test(row.raw) || /^\s*[-*]\s+\[?/.test(row.raw);
}

function isNoisyMarkdownLine(text, raw = "") {
  const lower = text.toLowerCase();
  const navTerms = [
    "epaper",
    "live tv",
    "dawnnews urdu",
    "advertise",
    "supplements",
    "careers",
    "obituaries",
    "subscribe",
    "notifications",
    "prayer timings",
    "privacy policy",
    "contact us",
    "copyright",
    "designed for dawn",
    "image:",
    "logo"
  ];

  if (/^(title|url source|markdown content|published time):/i.test(text)) {
    return true;
  }

  if ((raw.match(/\]\(/g) || []).length >= 3) {
    return true;
  }

  if ((text.match(/[A-Z][a-z]+/g) || []).length >= 8 && !/[.!?]$/.test(text)) {
    return true;
  }

  return navTerms.some((term) => lower.includes(term));
}

function extractFromHtml(html, config, targetDateIso) {
  const pageDateIso = pageDateFromText(html, targetDateIso, config.assumeUrlDate);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...doc.querySelectorAll(config.selectors.titles)];
  const seen = new Set();
  const items = [];

  for (const anchor of anchors) {
    if (items.length >= 8) {
      break;
    }

    const title = sanitizeArticleText(anchor.textContent);
    const href = normalizeUrl(anchor.getAttribute("href"), config.url);
    if (!looksLikeTitle(title) || (config.urlAllow && !config.urlAllow.test(href)) || seen.has(`${title}|${href}`)) {
      continue;
    }

    seen.add(`${title}|${href}`);
    const container = anchor.closest("article, li, .story, .media, .col, .listing, div") || anchor.parentElement;
    const author = findAuthor(container, config.selectors.authorLinks);
    const teaser = findTeaser(container, title, author);
    const dateIso = findItemDate(container, pageDateIso, targetDateIso);
    items.push(makeItem(title, author, teaser, href, dateIso));
  }

  return makeSection(config.source, items, "live");
}

function findItemDate(container, pageDateIso, targetDateIso) {
  if (!container) {
    return pageDateIso;
  }
  const text = cleanText(container.textContent);
  return itemDateFromText(text, pageDateIso, targetDateIso) || pageDateIso;
}

function looksLikeTitle(title) {
  title = sanitizeArticleText(title);
  const banned = [
    "read more",
    "opinion",
    "editorial",
    "analysis & comment",
    "analysis and comment",
    "more news",
    "home",
    "latest",
    "pakistan",
    "business",
    "world",
    "sports",
    "videos",
    "front page",
    "national",
    "metros",
    "web archive"
  ];
  const lower = title.toLowerCase();
  if (/^(title|url source|markdown content|published time):/i.test(title)) {
    return false;
  }
  if (looksLikeAuthor(title)) {
    return false;
  }
  if (/https?:|www\.|\.com|^\[|]$|\]\(/i.test(title)) {
    return false;
  }
  return title.length >= 8 && title.length <= 115 && !banned.includes(lower) && !lower.includes("subscribe");
}

function looksLikeAuthor(text) {
  if (!text || text.length > 45) {
    return false;
  }
  if (/updated|today|paper|copyright|follow|image/i.test(text)) {
    return false;
  }
  return /editorial|dr\.?|prof\.?|[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text);
}

function findAuthor(container, selector) {
  if (!container) {
    return "Editorial";
  }
  const authorNode = container.querySelector(selector);
  if (authorNode && looksLikeAuthor(cleanText(authorNode.textContent))) {
    return cleanText(authorNode.textContent);
  }

  const lines = cleanText(container.textContent).split(/\s\|\s| Updated | By /i);
  const candidate = lines.find((line) => looksLikeAuthor(cleanText(line)));
  return cleanText(candidate) || "Editorial";
}

function findTeaser(container, title, author) {
  if (!container) {
    return "";
  }
  const paragraph = [...container.querySelectorAll("p")]
    .map((node) => sanitizeArticleText(node.textContent))
    .find((text) => text.length > 35 && !text.includes(title) && !text.includes(author));

  if (paragraph) {
    return paragraph;
  }

  const text = sanitizeArticleText(container.textContent)
    .replace(title, "")
    .replace(author, "")
    .replace(/Updated .+? \|/i, "")
    .trim();
  return text.length > 35 ? text.slice(0, 210) : "";
}

function makeItem(title, author, teaser, url = "", dateIso = "") {
  const cleanTitle = sanitizeArticleText(title);
  const cleanTeaser = sanitizeArticleText(teaser);
  const theme = classifyTheme(`${cleanTitle} ${cleanTeaser}`);
  const summary = sanitizeArticleText(buildSummary(cleanTitle, cleanTeaser, theme)).replace(/\.+$/g, ".");
  return {
    title: cleanTitle,
    author: cleanText(author || "Editorial"),
    theme,
    tone: toneForItem(theme, `${title} ${summary}`),
    summary,
    url,
    dateIso
  };
}

function makeSection(source, items, status) {
  const cleanItems = items.filter((item) => item.title && item.summary).slice(0, 7);
  return {
    source,
    status,
    scores: cleanItems.length ? scoreSection(cleanItems) : emptyScores(),
    items: cleanItems
  };
}

function unavailableSection(source, error) {
  return {
    source,
    status: "blocked",
    error,
    scores: emptyScores(),
    items: [
      {
        title: "Live fetch unavailable",
        author: "Target website",
        theme: "State",
        tone: "critical",
        summary:
          "could not retrieve the latest items from this newspaper; click Fetch again or check browser/network access to the live source."
      }
    ]
  };
}

async function loadScrapedReport(targetDateIso) {
  const apiUrls = [
    `/api/report?date=${encodeURIComponent(targetDateIso)}`,
    `http://localhost:8787/api/report?date=${encodeURIComponent(targetDateIso)}`
  ];

  let lastError = null;
  for (const apiUrl of apiUrls) {
    try {
      const response = await fetch(apiUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.sections || !Array.isArray(data.sections)) {
        throw new Error("Invalid scraper response");
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Scraper backend unavailable");
}

function sourceUrls(config, targetDateIso) {
  if (typeof config.urlsForDate === "function") {
    return config.urlsForDate(targetDateIso);
  }
  return [config.url];
}

async function loadSource(config, targetDateIso) {
  try {
    const sections = [];
    for (const url of sourceUrls(config, targetDateIso)) {
      const text = await fetchText(url);
      const scopedConfig = { ...config, url };
      sections.push(
        text.trim().startsWith("<")
          ? extractFromHtml(text, scopedConfig, targetDateIso)
          : extractFromMarkdown(text, scopedConfig, targetDateIso)
      );
    }

    const seen = new Set();
    const datedItems = sections
      .flatMap((section) => section.items)
      .filter((item) => item.dateIso === targetDateIso)
      .filter((item) => {
        const key = `${item.title}|${item.author}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

    if (!datedItems.length) {
      throw new Error(`No articles found for ${formatDisplayDate(targetDateIso)}`);
    }

    return makeSection(config.source, datedItems, "live");
  } catch (error) {
    return unavailableSection(config.source, error.message);
  }
}

async function refreshLatest() {
  if (isFetching) {
    return;
  }
  const targetDateIso = selectedReportDate();
  isFetching = true;
  setBackgroundGlobe(true);
  setStatus(`Scraping ${formatDisplayDate(targetDateIso)}`);
  document.querySelector("#refreshButton").disabled = true;
  renderLoadingReport();
  renderSourceStatus(sourceConfigs.map((config) => ({ source: config.source, status: "loading" })));
  let usedScraper = false;
  try {
    reportData = await loadScrapedReport(targetDateIso);
    usedScraper = true;
  } catch {
    const sections = await Promise.all(sourceConfigs.map((config) => loadSource(config, targetDateIso)));
    reportData = {
      date: formatDisplayDate(targetDateIso),
      readTime: estimateReadTime(sections),
      fetchWindow: `Date filter: only ${formatDisplayDate(targetDateIso)} articles/op-eds`,
      fetchedAt: formatFetchTime(),
      sections
    };
  }
  const liveCount = reportData.sections.filter((section) => section.status === "live" || section.status === "scraped").length;
  resetFilters();
  setReportMeta();
  renderScores();
  isFetching = false;
  document.querySelector("#refreshButton").disabled = false;
  renderReport();
  renderSourceStatus(reportData.sections);
  setStatus(liveCount ? `${usedScraper ? "Scraped" : "Live"} ${liveCount}/3` : "Scrape unavailable");
  setBackgroundGlobe(false);
}

function estimateReadTime(sections) {
  const words = sections.reduce((total, section) => {
    return (
      total +
      section.items.reduce((itemTotal, item) => {
        return itemTotal + `${item.title} ${item.author} ${item.summary}`.split(/\s+/).length;
      }, 0)
    );
  }, 0);
  return `Approx reading time: ${Math.max(2, Math.ceil(words / 220))} minutes`;
}

function getThemes() {
  const themes = new Set();
  reportData.sections.forEach((section) => {
    section.items.forEach((item) => themes.add(item.theme));
  });
  return [...themes].sort();
}

function resetFilters() {
  const sourceValue = sourceFilter.value || "all";
  const themeValue = themeFilter.value || "all";

  sourceFilter.replaceChildren(new Option("All newspapers", "all"));
  themeFilter.replaceChildren(new Option("All themes", "all"));

  reportData.sections.forEach((section) => {
    sourceFilter.append(new Option(section.source, section.source));
  });

  getThemes().forEach((theme) => {
    themeFilter.append(new Option(theme, theme));
  });

  sourceFilter.value = [...sourceFilter.options].some((option) => option.value === sourceValue) ? sourceValue : "all";
  themeFilter.value = [...themeFilter.options].some((option) => option.value === themeValue) ? themeValue : "all";
}

function sectionMatches(section, item, query, selectedSource, selectedTheme) {
  const sourceMatches = selectedSource === "all" || section.source === selectedSource;
  const themeMatches = selectedTheme === "all" || item.theme === selectedTheme;
  const text = `${section.source} ${item.title} ${item.author} ${item.theme} ${item.summary}`.toLowerCase();
  return sourceMatches && themeMatches && text.includes(query);
}

function renderReport() {
  if (isFetching) {
    renderLoadingReport();
    return;
  }

  const selectedSource = sourceFilter.value;
  const selectedTheme = themeFilter.value;
  const query = searchInput.value.trim().toLowerCase();
  reviewSections.replaceChildren();

  let totalItems = 0;

  reportData.sections.forEach((section) => {
    const matchingItems = section.items.filter((item) =>
      sectionMatches(section, item, query, selectedSource, selectedTheme)
    );

    if (!matchingItems.length) {
      return;
    }

    totalItems += matchingItems.length;

    const sourceSection = document.createElement("section");
    sourceSection.className = "source-section";

    const heading = document.createElement("h3");
    heading.className = "source-heading";
    heading.textContent = section.source;

    const scoreLine = document.createElement("p");
    scoreLine.className = "score-line";
    scoreLine.innerHTML = `<strong>Comparative score line:</strong> ${scoreNames
      .map((name) => `<strong>${name}</strong> ${formatScore(section.scores[name])}`)
      .join(" | ")}`;

    const list = document.createElement("ul");
    list.className = "review-list";

    matchingItems.forEach((item) => {
      const li = document.createElement("li");
      const titleClass = item.tone === "positive" ? "article-title positive" : "article-title";
      li.innerHTML = `<span class="${titleClass}">${escapeHtml(item.title)}</span>, <span class="author">${escapeHtml(item.author)}</span>, ${escapeHtml(item.summary)}`;
      list.append(li);
    });

    sourceSection.append(heading, scoreLine, list);
    reviewSections.append(sourceSection);
  });

  if (!totalItems) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matching review items.";
    reviewSections.append(empty);
  }
}

function renderLoadingReport() {
  reviewSections.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "report-loading";
  loading.innerHTML = `
    <div class="loading-globe" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <strong>Fetching latest print media review</strong>
    <p>Dawn and The Express Tribune are being checked now.</p>
  `;
  reviewSections.append(loading);
}

function renderScores() {
  const averages = scoreNames.map((name) => {
    const total = reportData.sections.reduce((sum, section) => sum + section.scores[name], 0);
    return {
      name,
      value: total / reportData.sections.length
    };
  });

  scoreBars.replaceChildren();

  averages.forEach(({ name, value }) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `
      <div class="score-label">
        <span>${name}</span>
        <strong>${formatScore(value)}</strong>
      </div>
      <div class="meter"><span style="width: ${(value / 5) * 100}%"></span></div>
    `;
    scoreBars.append(row);
  });
}

function renderSourceStatus(sections) {
  sourceStatus.replaceChildren();
  const liveCount = sections.filter((section) => section.status === "live").length;
  sourceCount.textContent = `${liveCount}/3`;

  sections.forEach((section) => {
    const chip = document.createElement("div");
    const statusClass = section.status === "live" || section.status === "scraped" ? "ok" : section.status === "blocked" ? "fail" : "";
    const label = section.status === "scraped" ? "scraped" : section.status === "live" ? "live" : section.status === "blocked" ? "unavailable" : "loading";
    chip.className = `source-chip ${statusClass}`;
    chip.innerHTML = `<span></span><strong>${escapeHtml(section.source)}</strong><em>${label}</em>`;
    sourceStatus.append(chip);
  });
}

function setReportMeta() {
  document.querySelector("#reportDate").textContent = reportData.date;
  document.querySelector("#documentDate").textContent = reportData.date;
  document.querySelector("#readTime").textContent = reportData.readTime;
  document.querySelector("#documentReadTime").textContent = reportData.readTime;
  document.querySelector("#fetchWindow").textContent = reportData.fetchWindow;
  document.querySelector("#documentFetchWindow").textContent = reportData.fetchWindow;
  document.querySelector("#fetchTime").textContent = reportData.fetchedAt;
  document.querySelector("#documentFetchTime").textContent = reportData.fetchedAt;
}

function setStatus(value) {
  reportStatus.textContent = value;
}

function setBackgroundGlobe(visible) {
  const globeCanvas = document.querySelector("#globeCanvas");
  if (!globeCanvas) {
    return;
  }
  globeCanvas.style.opacity = visible ? "0.24" : "0";
}

function triggerPrint() {
  window.print();
}

function savePdf() {
  const originalTitle = document.title;
  document.title = `Pakistan-Print-Media-Review-${new Date().toISOString().slice(0, 10)}`;
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 700);
}

function downloadWord() {
  const documentHtml = document.querySelector("#reportDocument").outerHTML;
  const styles = `
    body { background: #fff; margin: 0; }
    .report-document { width: 100%; color: #161718; font-family: "Arial Narrow", Arial, Helvetica, sans-serif; }
    .document-header { margin-bottom: 7px; padding-bottom: 2px; border-bottom: 1px solid #24465d; }
    .document-header h2 { margin: 0; color: #24465d; font-size: 30pt; line-height: 1; }
    .document-header p { margin: 2px 0 0; color: #151515; font-size: 14pt; }
    .source-section { margin-top: 8px; }
    .source-heading { margin: 0 0 2px; color: #24465d; font-size: 21pt; line-height: 1; }
    .score-line { margin: 0 0 1px; font-size: 14.5pt; line-height: 1.16; }
    .score-line strong:first-child, .article-title { color: #b01620; }
    .article-title.positive { color: #b01620; }
    .review-list { margin: 0 0 0 18pt; padding: 0; list-style-type: square; }
    .review-list li { margin: 0; padding-left: 3pt; font-size: 16pt; line-height: 1.18; text-align: justify; }
    .author { font-weight: 800; }
  `;
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>${styles}</style>
      </head>
      <body>${documentHtml}</body>
    </html>
  `;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Pakistan-Print-Media-Review-${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initReport() {
  reportDateInput.value = todayIso();
  reportData = {
    date: formatDisplayDate(selectedReportDate()),
    readTime: "Fetching latest",
    fetchWindow: `Date filter: only ${formatDisplayDate(selectedReportDate())} articles/op-eds`,
    fetchedAt: "Fetching now",
    sections: sourceConfigs.map((config) => ({
      source: config.source,
      status: "loading",
      scores: emptyScores(),
      items: []
    }))
  };
  setReportMeta();
  resetFilters();
  renderScores();
  renderLoadingReport();
  renderSourceStatus(sourceConfigs.map((config) => ({ source: config.source, status: "loading" })));
  setBackgroundGlobe(false);

  sourceFilter.addEventListener("change", renderReport);
  themeFilter.addEventListener("change", renderReport);
  searchInput.addEventListener("input", renderReport);
  reportDateInput.addEventListener("change", refreshLatest);
  document.querySelector("#refreshButton").addEventListener("click", refreshLatest);
  document.querySelector("#printButton").addEventListener("click", triggerPrint);
  document.querySelector("#pdfButton").addEventListener("click", savePdf);
  document.querySelector("#wordButton").addEventListener("click", downloadWord);

  refreshLatest();
}

function initGlobe() {
  const canvas = document.querySelector("#globeCanvas");
  const ctx = canvas.getContext("2d");
  const points = [];
  const rings = [];
  let width = 0;
  let height = 0;
  let radius = 0;
  let centerX = 0;
  let centerY = 0;
  let time = 0;

  for (let lat = -70; lat <= 70; lat += 14) {
    const latRad = (lat * Math.PI) / 180;
    for (let lon = 0; lon < 360; lon += 16) {
      points.push({
        lat: latRad,
        lon: (lon * Math.PI) / 180,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  for (let i = 0; i < 7; i += 1) {
    rings.push({
      tilt: (i / 7) * Math.PI,
      speed: 0.004 + i * 0.0006,
      phase: i * 0.8
    });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.min(width, height) * (width < 760 ? 0.34 : 0.42);
    centerX = width * (width < 900 ? 0.5 : 0.72);
    centerY = height * (width < 900 ? 0.24 : 0.43);
  }

  function project(lat, lon, rotation) {
    const rotatedLon = lon + rotation;
    const x = Math.cos(lat) * Math.sin(rotatedLon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(rotatedLon);
    return {
      x: centerX + x * radius,
      y: centerY + y * radius * 0.78,
      z
    };
  }

  function drawRing(ring) {
    ctx.beginPath();
    for (let i = 0; i <= 240; i += 1) {
      const angle = (i / 240) * Math.PI * 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle) * Math.sin(ring.tilt);
      const z = Math.sin(angle) * Math.cos(ring.tilt);
      const drift = time * ring.speed + ring.phase;
      const screenX = centerX + (x * Math.cos(drift) - z * Math.sin(drift)) * radius;
      const screenY = centerY + y * radius * 0.78;
      if (i === 0) {
        ctx.moveTo(screenX, screenY);
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }
    ctx.stroke();
  }

  function animate() {
    time += 1;
    ctx.clearRect(0, 0, width, height);
    const rotation = time * 0.004;

    const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 1.22);
    glow.addColorStop(0, "rgba(61, 242, 212, 0.22)");
    glow.addColorStop(0.52, "rgba(61, 242, 212, 0.055)");
    glow.addColorStop(1, "rgba(61, 242, 212, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(61, 242, 212, 0.18)";
    ctx.lineWidth = 1;
    rings.forEach(drawRing);

    points.forEach((point) => {
      const projected = project(point.lat, point.lon, rotation);
      if (projected.z < -0.32) {
        return;
      }

      const alpha = 0.22 + projected.z * 0.58;
      const size = 1.1 + projected.z * 1.5 + Math.sin(time * 0.025 + point.pulse) * 0.45;
      ctx.fillStyle = `rgba(61, 242, 212, ${Math.max(0.08, alpha)})`;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, Math.max(0.5, size), 0, Math.PI * 2);
      ctx.fill();
    });

    const pakistanLat = (30.4 * Math.PI) / 180;
    const pakistanLon = (69.3 * Math.PI) / 180;
    const marker = project(pakistanLat, pakistanLon, rotation - Math.PI * 0.08);
    if (marker.z > -0.2) {
      ctx.strokeStyle = "rgba(247, 200, 87, 0.9)";
      ctx.fillStyle = "rgba(247, 200, 87, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();
}

initReport();
initGlobe();
