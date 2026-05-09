import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { AUDIO_DIR } from "../config/env";

export const audioRouter = Router();

audioRouter.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ error: "invalid_filename" });
  }
  const full = path.join(AUDIO_DIR, filename);
  if (!full.startsWith(AUDIO_DIR)) {
    return res.status(400).json({ error: "invalid_path" });
  }
  if (!fs.existsSync(full)) {
    return res.status(404).json({ error: "not_found" });
  }
  res.sendFile(full);
});
