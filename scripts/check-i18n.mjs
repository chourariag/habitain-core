#!/usr/bin/env node
/**
 * i18n coverage guard.
 *
 * 1. Key parity: every key in src/i18n/en.json must exist in hi/kn/ta/te.
 * 2. Hardcoded-string guard: files listed in ENFORCED (already migrated to t())
 *    must not contain bare English JSX text nodes or user-visible string props.
 *
 * As each page is migrated, add it to ENFORCED so coverage cannot regress.
 * Run: node scripts/check-i18n.mjs   (npm run check:i18n)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LANGS = ["hi", "kn", "ta", "te"];

// Files whose visible strings must all go through t()
const ENFORCED = [
  "src/components/AppSidebar.tsx",
  "src/components/MobileNav.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/Profile.tsx",
  "src/components/dashboard/Tier1Dashboard.tsx",
  "src/components/dashboard/PlaceholderDashboard.tsx",
];

const errors = [];

// ---------- 1. key parity ----------
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

const en = JSON.parse(fs.readFileSync(path.join(ROOT, "src/i18n/en.json"), "utf8"));
const enKeys = flatten(en);
for (const lang of LANGS) {
  const file = path.join(ROOT, `src/i18n/${lang}.json`);
  const keys = new Set(flatten(JSON.parse(fs.readFileSync(file, "utf8"))));
  const missing = enKeys.filter((k) => !keys.has(k));
  if (missing.length) {
    errors.push(`${lang}.json is missing ${missing.length} key(s): ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? ", …" : ""}`);
  }
}

// ---------- 2. hardcoded strings in enforced files ----------
const TEXT_PROPS = ["placeholder", "title", "label", "aria-label", "alt", "emptyMessage"];
const hasLetters = (s) => /[A-Za-z]{2,}/.test(s);
const IGNORE_TEXT = /^(?:[-–—•·|/\\+×,.:;!?()[\]{}#&%*]|\s|&\w+;|\{)*$/;

for (const rel of ENFORCED) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    // bare JSX text node: >Some words<
    for (const m of line.matchAll(/>([^<>{}\n]+)</g)) {
      const text = m[1].trim();
      if (!text || IGNORE_TEXT.test(text) || !hasLetters(text)) continue;
      errors.push(`${rel}:${ln} hardcoded JSX text "${text}" — wrap in t()`);
    }

    // user-visible string props
    for (const prop of TEXT_PROPS) {
      const re = new RegExp(`\\b${prop}="([^"]{2,})"`, "g");
      for (const m of line.matchAll(re)) {
        if (!hasLetters(m[1])) continue;
        errors.push(`${rel}:${ln} hardcoded ${prop}="${m[1]}" — wrap in t()`);
      }
    }

    // toast messages
    for (const m of line.matchAll(/toast\.(?:success|error|info|warning)\(\s*"([^"]+)"/g)) {
      errors.push(`${rel}:${ln} hardcoded toast "${m[1]}" — wrap in t()`);
    }
  });
}

if (errors.length) {
  console.error("i18n check failed:\n" + errors.map((e) => `  ✗ ${e}`).join("\n"));
  console.error(`\n${errors.length} problem(s). Add keys to src/i18n/en.json (reuse common.*) and mirror to ${LANGS.join(", ")}.`);
  process.exit(1);
}

console.log(`i18n check passed — ${enKeys.length} keys in sync across ${LANGS.length + 1} locales; ${ENFORCED.length} file(s) enforced.`);
