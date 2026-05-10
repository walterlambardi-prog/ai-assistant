-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "defaultModel" TEXT NOT NULL DEFAULT 'qwen2.5:7b',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL NOT NULL DEFAULT 0.9,
    "ollamaBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sttEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ttsVoice" TEXT,
    "ttsRate" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppConfig" ("createdAt", "defaultModel", "id", "ollamaBaseUrl", "sttEnabled", "temperature", "topP", "ttsEnabled", "ttsRate", "ttsVoice", "updatedAt") SELECT "createdAt", "defaultModel", "id", "ollamaBaseUrl", "sttEnabled", "temperature", "topP", "ttsEnabled", "ttsRate", "ttsVoice", "updatedAt" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
