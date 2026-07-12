import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
const port = 7070;

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic CORS for local frontend testing
// This allows your Next.js app on localhost:3000 to call localhost:7070.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

// Configure Multer to hold the file in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ─────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────── */

const FREE_APIS = {
  catFact: "https://catfact.ninja/fact",
  randomMeal: "https://www.themealdb.com/api/json/v1/1/random.php",
  dogImage: "https://dog.ceo/api/breeds/image/random",
  advice: "https://api.adviceslip.com/advice",
};

const fallbackFacts = [
  "This fallback fact was generated locally because the public API did not respond.",
  "Dynamic popups can combine stored polygon metadata with live API data.",
  "Each refresh can return different content while preserving the same popup schema.",
  "The local API can later be replaced with your real campus data service.",
];

const fallbackMeals = [
  {
    name: "Campus Bowl",
    category: "Sample Meal",
    area: "Local",
    instructions: "A locally generated fallback meal used for popup testing.",
    image: "https://picsum.photos/seed/fallback-campus-bowl/700/400",
  },
  {
    name: "Study Snack Plate",
    category: "Sample Meal",
    area: "Local",
    instructions:
      "Another fallback item so the dining popup still changes during tests.",
    image: "https://picsum.photos/seed/fallback-study-snack/700/400",
  },
];

const randomItem = (items) => {
  return items[Math.floor(Math.random() * items.length)];
};

const uniqueSeed = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const picsum = (seed, width = 700, height = 400) => {
  return `https://picsum.photos/seed/${encodeURIComponent(
    seed,
  )}/${width}/${height}`;
};

async function requestJson(url, options = {}) {
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(fetchOptions.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function safeRequestJson(url, fallbackValue, options = {}) {
  try {
    return await requestJson(url, options);
  } catch (error) {
    console.warn(`Public API request failed for ${url}:`, error.message);
    return fallbackValue;
  }
}

function extractRequestFeature(req) {
  return req.body?.feature ?? null;
}

function buildRequestContext(req) {
  return {
    method: req.method,
    requested_at: new Date().toISOString(),
    body: req.body ?? null,
  };
}

function buildCommonFlags(category) {
  return {
    hasImages: true,
    hasNestedContent: true,
    supportsRefresh: true,
    category,
    dynamic: true,
  };
}

/* ─────────────────────────────────────────
 * Dynamic popup response builders
 * ───────────────────────────────────── */

async function buildLibraryPopupResponse(req) {
  const feature = extractRequestFeature(req);

  const catFact = await safeRequestJson(FREE_APIS.catFact, {
    fact: randomItem(fallbackFacts),
    length: null,
  });

  const seed = uniqueSeed("library");

  return {
    description: `Library dynamic update: ${catFact.fact}`,
    source: "local-node-api + catfact.ninja + picsum.photos",
    api_endpoint: "http://localhost:7070/api/popup/library",
    popup_type: "advanced_structured_popup",
    requested_at: new Date().toISOString(),
    flags: buildCommonFlags("academic"),
    geometry: feature?.geometry ?? null,
    id: feature?.id ?? "sample-library-popup",
    image_urls: [picsum(`${seed}-main`), picsum(`${seed}-study-space`)],
    label: {
      hideAfter: null,
      hideBefore: 15,
      name: "Library",
    },
    location_id: feature?.location_id ?? 1001,
    nested_content: [
      {
        title: "Library Live Details",
        tabs: [
          {
            title: "Generated",
            sections: [
              {
                header: "Fresh API content",
                image_urls: [picsum(`${seed}-nested`)],
                bullets: [
                  `Cat fact length: ${catFact.length ?? "unknown"}`,
                  "This changed because the popup called the local Node endpoint again.",
                  "The local endpoint then called a public API and returned your structured popup schema.",
                ],
              },
              {
                header: "Stored feature context",
                image_urls: [],
                bullets: [
                  `Feature id: ${feature?.id ?? "not provided"}`,
                  `Feature location_id: ${
                    feature?.location_id ?? "not provided"
                  }`,
                ],
              },
            ],
          },
        ],
      },
    ],
    request_context: buildRequestContext(req),
  };
}

async function buildDiningPopupResponse(req) {
  const feature = extractRequestFeature(req);

  const fallbackMeal = randomItem(fallbackMeals);
  const mealData = await safeRequestJson(FREE_APIS.randomMeal, {
    meals: [
      {
        strMeal: fallbackMeal.name,
        strCategory: fallbackMeal.category,
        strArea: fallbackMeal.area,
        strInstructions: fallbackMeal.instructions,
        strMealThumb: fallbackMeal.image,
      },
    ],
  });

  const meal = Array.isArray(mealData?.meals) ? mealData.meals[0] : null;
  const mealName = meal?.strMeal ?? fallbackMeal.name;
  const category = meal?.strCategory ?? fallbackMeal.category;
  const area = meal?.strArea ?? fallbackMeal.area;
  const instructions = meal?.strInstructions ?? fallbackMeal.instructions;
  const mealImage = meal?.strMealThumb ?? fallbackMeal.image;
  const seed = uniqueSeed("dining");

  return {
    description: `Dining dynamic update: ${mealName} (${category}, ${area}).`,
    source: "local-node-api + themealdb.com + picsum.photos",
    api_endpoint: "http://localhost:7070/api/popup/dining",
    popup_type: "advanced_structured_popup",
    requested_at: new Date().toISOString(),
    flags: buildCommonFlags("food"),
    geometry: feature?.geometry ?? null,
    id: feature?.id ?? "sample-dining-popup",
    image_urls: [mealImage, picsum(`${seed}-dining-area`)],
    label: {
      hideAfter: null,
      hideBefore: 15,
      name: "Dining",
    },
    location_id: feature?.location_id ?? 1002,
    nested_content: [
      {
        title: "Dining Live Details",
        tabs: [
          {
            title: "Random meal",
            sections: [
              {
                header: mealName,
                image_urls: [mealImage],
                bullets: [
                  `Category: ${category}`,
                  `Area: ${area}`,
                  `Instructions preview: ${String(instructions).slice(
                    0,
                    180,
                  )}...`,
                ],
              },
            ],
          },
          {
            title: "Testing",
            sections: [
              {
                header: "Refresh behavior",
                image_urls: [],
                bullets: [
                  "Press the popup refresh button to request a new random meal.",
                  "The response shape stays the same even though the content changes.",
                ],
              },
            ],
          },
        ],
      },
    ],
    request_context: buildRequestContext(req),
  };
}

async function buildParkingPopupResponse(req) {
  const feature = extractRequestFeature(req);

  const cacheBuster = Date.now();
  const [dogData, adviceData] = await Promise.all([
    safeRequestJson(FREE_APIS.dogImage, {
      message: picsum(uniqueSeed("parking-fallback-dog")),
      status: "fallback",
    }),
    safeRequestJson(`${FREE_APIS.advice}?t=${cacheBuster}`, {
      slip: {
        id: Math.floor(Math.random() * 10000),
        advice: randomItem(fallbackFacts),
      },
    }),
  ]);

  const dogImage =
    typeof dogData?.message === "string"
      ? dogData.message
      : picsum(uniqueSeed("parking-dog"));

  const advice = adviceData?.slip?.advice ?? randomItem(fallbackFacts);
  const seed = uniqueSeed("parking");

  return {
    description: `Parking dynamic update: ${advice}`,
    source: "local-node-api + dog.ceo + adviceslip.com + picsum.photos",
    api_endpoint: "http://localhost:7070/api/popup/parking",
    popup_type: "advanced_structured_popup",
    requested_at: new Date().toISOString(),
    flags: buildCommonFlags("parking"),
    geometry: feature?.geometry ?? null,
    id: feature?.id ?? "sample-parking-popup",
    image_urls: [dogImage, picsum(`${seed}-lot`)],
    label: {
      hideAfter: null,
      hideBefore: null,
      name: "Parking",
    },
    location_id: feature?.location_id ?? 1003,
    nested_content: [
      {
        title: "Parking Live Details",
        tabs: [
          {
            title: "Generated status",
            sections: [
              {
                header: "Dynamic parking note",
                image_urls: [dogImage],
                bullets: [
                  advice,
                  `Advice id: ${adviceData?.slip?.id ?? "fallback"}`,
                  "This endpoint intentionally changes on refresh to simulate a live system.",
                ],
              },
              {
                header: "Simulated occupancy",
                image_urls: [],
                bullets: [
                  `Available spaces: ${Math.floor(20 + Math.random() * 180)}`,
                  `Occupancy: ${Math.floor(15 + Math.random() * 80)}%`,
                  `Updated: ${new Date().toLocaleTimeString()}`,
                ],
              },
            ],
          },
        ],
      },
    ],
    request_context: buildRequestContext(req),
  };
}

const popupBuilders = {
  library: buildLibraryPopupResponse,
  dining: buildDiningPopupResponse,
  parking: buildParkingPopupResponse,
};

async function buildPopupResponse(source, req) {
  const key = String(source || "").toLowerCase();
  const builder = popupBuilders[key];

  if (!builder) {
    return null;
  }

  return builder(req);
}

async function sendPopupResponse(req, res, source) {
  try {
    const response = await buildPopupResponse(source, req);

    if (!response) {
      return res.status(404).json({
        error: "Popup source not found.",
        source,
        available_sources: Object.keys(popupBuilders),
      });
    }

    return res.json(response);
  } catch (error) {
    console.error(`Failed to build popup response for ${source}:`, error);

    return res.status(500).json({
      error: "Failed to build popup response.",
      source,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/* ─────────────────────────────────────────
 * Basic HTML UI
 * ───────────────────────────────────── */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ─────────────────────────────────────────
 * Popup API endpoints
 * ───────────────────────────────────── */

app.get("/api/popup/library", (req, res) => {
  void sendPopupResponse(req, res, "library");
});

app.post("/api/popup/library", (req, res) => {
  void sendPopupResponse(req, res, "library");
});

app.get("/api/popup/dining", (req, res) => {
  void sendPopupResponse(req, res, "dining");
});

app.post("/api/popup/dining", (req, res) => {
  void sendPopupResponse(req, res, "dining");
});

app.get("/api/popup/parking", (req, res) => {
  void sendPopupResponse(req, res, "parking");
});

app.post("/api/popup/parking", (req, res) => {
  void sendPopupResponse(req, res, "parking");
});

// Generic fallback if you later want to use /api/popup/:source.
app.get("/api/popup/:source", (req, res) => {
  void sendPopupResponse(req, res, req.params.source);
});

app.post("/api/popup/:source", (req, res) => {
  void sendPopupResponse(req, res, req.params.source);
});

/* ─────────────────────────────────────────
 * Upload endpoint
 * ───────────────────────────────────── */

app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  // Create a unique filename to prevent overwriting
  const uniqueFileName = `${Date.now()}-${req.file.originalname.replace(
    /\s+/g,
    "-",
  )}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `images/${uniqueFileName}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  });

  try {
    await s3Client.send(command);

    // The final CloudFront URL
    const imageUrl = `https://tiles.flavioherrera.com/images/${uniqueFileName}`;

    return res.status(200).json({
      message: "Upload successful",
      url: imageUrl,
    });
  } catch (error) {
    console.error("Error uploading to S3:", error);
    return res.status(500).json({ error: "Failed to upload image to S3" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Popup API: http://localhost:${port}/api/popup/library`);
  console.log(`Popup API: http://localhost:${port}/api/popup/dining`);
  console.log(`Popup API: http://localhost:${port}/api/popup/parking`);
});
// import express from "express";
// import multer from "multer";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// dotenv.config();

// const app = express();
// const port =7070;

// // Set up __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Configure AWS S3 Client
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
// });

// // Configure Multer to hold the file in memory
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // Serve the basic HTML UI
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "index.html"));
// });

// // The upload endpoint
// app.post("/upload", upload.single("image"), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ error: "No image file provided." });
//   }

//   // Create a unique filename to prevent overwriting
//   const uniqueFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;

//   const command = new PutObjectCommand({
//     Bucket: process.env.AWS_BUCKET_NAME,
//     Key: `images/${uniqueFileName}`,
//     Body: req.file.buffer,
//     ContentType: req.file.mimetype,
//   });

//   try {
//     await s3Client.send(command);

//     // The final CloudFront URL
//     const imageUrl = `https://tiles.flavioherrera.com/images/${uniqueFileName}`;

//     res.status(200).json({
//       message: "Upload successful",
//       url: imageUrl,
//     });
//   } catch (error) {
//     console.error("Error uploading to S3:", error);
//     res.status(500).json({ error: "Failed to upload image to S3" });
//   }
// });

// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });
