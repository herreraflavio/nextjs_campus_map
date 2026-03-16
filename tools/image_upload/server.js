import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
const port = process.env.PORT || 7050;

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

// Configure Multer to hold the file in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve the basic HTML UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// The upload endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  // Create a unique filename to prevent overwriting
  const uniqueFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;

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

    res.status(200).json({
      message: "Upload successful",
      url: imageUrl,
    });
  } catch (error) {
    console.error("Error uploading to S3:", error);
    res.status(500).json({ error: "Failed to upload image to S3" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
