const fs = require("fs");
const path = require("path");
const i18n = require("../src/i18n/translation.json");

const namespace = "openhands";

// { [lang]: { [key]: content } }
const translationMap = {};

Object.entries(i18n).forEach(([key, transMap]) => {
  Object.entries(transMap).forEach(([lang, content]) => {
    if (!translationMap[lang]) {
      translationMap[lang] = {};
    }
    translationMap[lang][key] = content;
  });
});

function writeIfChanged(filePath, content) {
  const next = typeof content === "string" ? content : String(content);
  try {
    const current = fs.readFileSync(filePath, "utf8");
    if (current === next) {
      return false;
    }
  } catch {
    // file missing -> write it
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next);
  return true;
}

// Write translation files. Important: do NOT delete public/locales on every
// run — that churn alone makes React Router/Vite think config inputs changed
// and it restarts in a loop. Only touch files whose contents actually differ.
Object.entries(translationMap).forEach(([lang, transMap]) => {
  const filePath = path.join(
    __dirname,
    `../public/locales/${lang}/${namespace}.json`,
  );
  writeIfChanged(filePath, JSON.stringify(transMap, null, 2));
});

// Write translation key enum only when it actually changed.
const transKeys = Object.keys(translationMap.en);
const transKeyDeclareFilePath = path.join(
  __dirname,
  "../src/i18n/declaration.ts",
);
writeIfChanged(
  transKeyDeclareFilePath,
  `
// this file generate by script, don't modify it manually!!!
export enum I18nKey {
${transKeys.map((key) => `  ${key} = "${key}",`).join("\n")}
}`.trim() + "\n",
);
