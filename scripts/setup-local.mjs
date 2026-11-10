// Generate local-only credentials. Nothing secret is printed or committed.
import { randomBytes, scryptSync } from "node:crypto";
import { access, writeFile, unlink } from "node:fs/promises";

const envFile = new URL("../.env.local", import.meta.url);
const ownerFile = new URL("../.owner-access.txt", import.meta.url);
for (const file of [envFile, ownerFile]) {
  try {
    await access(file);
    throw new Error(`${file.pathname} already exists. Existing credentials were not changed.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const secret = randomBytes(48).toString("hex");
await writeFile(ownerFile, `CityBond local content portal\nPortal: http://localhost:3001/studio-7c9e\nOwner password: ${password}\n`, { mode: 0o600, flag: "wx" });
try {
  await writeFile(envFile, `CMS_PASSWORD_HASH=${hash}\nCMS_SESSION_SECRET=${secret}\n`, { mode: 0o600, flag: "wx" });
} catch (error) {
  await unlink(ownerFile);
  throw error;
}
console.log("Local portal configured. Your password is in .owner-access.txt (gitignored).");
console.log("Run npm run dev, then open http://localhost:3001/studio-7c9e.");
