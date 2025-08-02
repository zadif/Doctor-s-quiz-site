const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = __dirname;
const uppercaseExtensions = [".PNG", ".JPG", ".JPEG", ".GIF", ".SVG"];

function forceGitRename(oldPath, newPath) {
  const tempPath = oldPath + ".temp";

  // 1. Rename to a temp file
  fs.renameSync(oldPath, tempPath);

  // 2. Use git mv to rename it properly
  execSync(`git mv "${tempPath}" "${newPath}"`);
  console.log(
    `🔁 git mv: ${path.basename(oldPath)} → ${path.basename(newPath)}`
  );
}

function renameInFolder(folderPath) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      renameInFolder(entryPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const base = path.basename(entry.name, ext);

      if (uppercaseExtensions.includes(ext)) {
        const lowerExt = ext.toLowerCase();
        const newName = base + lowerExt;
        const newFullPath = path.join(folderPath, newName);

        forceGitRename(entryPath, newFullPath);
      }
    }
  }
}

try {
  const subfolders = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(rootDir, d.name));

  console.log(`🚀 Scanning: ${rootDir}`);
  for (const folder of subfolders) {
    console.log(`📁 Fixing folder: ${path.basename(folder)}`);
    renameInFolder(folder);
  }

  console.log("✅ All case renames staged in Git!");
} catch (err) {
  console.error("❌ Error:", err.message);
}
