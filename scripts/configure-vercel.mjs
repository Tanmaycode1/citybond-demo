// Run only after signing in with `npx vercel login` and linking the intended project.
// Secrets are passed through stdin, never command arguments or console output.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const values = Object.fromEntries(
  env
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const project = JSON.parse(
  await readFile(new URL("../.vercel/project.json", import.meta.url), "utf8"),
);
if (!project.projectName)
  throw new Error("Link the intended Vercel project first.");
console.log(`Configuring private editor settings for ${project.projectName}.`);
for (const name of ["CMS_PASSWORD_HASH", "CMS_SESSION_SECRET"]) {
  if (!values[name]) throw new Error(`Missing ${name}`);
  for (const target of ["production", "preview"]) {
    const result = spawnSync(
      "npx",
      ["vercel", "env", "add", name, target, "--sensitive", "--yes", "--force"],
      { input: values[name], encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(
        `Could not configure ${name} for ${target}. Check Vercel CLI authentication and project access.`,
      );
      process.exit(1);
    }
    console.log(`Configured ${name} for ${target}`);
  }
}
console.log("Private editor settings configured. Redeploy to apply.");
