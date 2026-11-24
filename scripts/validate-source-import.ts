import { readFile, writeFile } from "node:fs/promises";
import { validateContent } from "../src/lib/cms/schema";
import { importOriginalCopy } from "../src/lib/cms/original-copy";
async function main() {
const seed = JSON.parse(await readFile("src/data/site.json", "utf8"));
const result = importOriginalCopy(validateContent(seed));
await writeFile("src/data/site.json", JSON.stringify(result.content,null,2) + "\n");
console.log(JSON.stringify({pages:result.pages,blogs:result.content.blogs.length,bytes:Buffer.byteLength(JSON.stringify(result.content))}));

}
main().catch(error=>{ console.error(error);process.exitCode=1; });
