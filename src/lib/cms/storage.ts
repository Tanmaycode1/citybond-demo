import { get, put, list, BlobPreconditionFailedError } from "@vercel/blob";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  readdir,
} from "node:fs/promises";
import path from "node:path";
export class ConflictError extends Error {
  constructor() {
    super(
      "This content changed in another session. Reload the latest version before saving.",
    );
  }
}
export const storageReady = () =>
  !!(
    process.env.BLOB_STORE_ID ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    !process.env.VERCEL
  );
const cloud = () =>
  !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const localRoot = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.CMS_LOCAL_DIR || ".data",
  );
function safeKey(key: string) {
  if (
    !/^[a-zA-Z0-9_/.-]+$/.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  )
    throw new Error("Invalid storage path");
  return key;
}
const digest = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export async function readObject<T>(
  key: string,
): Promise<{ data: T; etag: string } | null> {
  safeKey(key);
  if (cloud()) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return {
      data: JSON.parse(await new Response(result.stream).text()),
      etag: result.blob.etag,
    };
  }
  if (process.env.VERCEL) throw new Error("Content storage is not configured");
  try {
    const b = await readFile(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ localRoot(),
        key,
      ),
    );
    return { data: JSON.parse(b.toString()), etag: digest(b) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function writeObject(
  key: string,
  data: unknown,
  expected?: string | null,
) {
  safeKey(key);
  const body = JSON.stringify(data);
  if (cloud()) {
    try {
      const result = await put(key, body, {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: expected !== null,
        ...(expected ? { ifMatch: expected } : {}),
        cacheControlMaxAge: 60,
      });
      return result.etag;
    } catch (e) {
      if (
        e instanceof BlobPreconditionFailedError ||
        (e instanceof Error && e.message.includes("already exists"))
      )
        throw new ConflictError();
      throw e;
    }
  }
  if (process.env.VERCEL) throw new Error("Content storage is not configured");
  const file = path.join(/* turbopackIgnore: true */ localRoot(), key);
  await mkdir(path.dirname(file), { recursive: true });
  const lock = file + ".lock";
  let locked = false;
  for (let i = 0; i < 20; i++) {
    try {
      await mkdir(lock);
      locked = true;
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  if (!locked) throw new ConflictError();
  try {
    const current = await readObject(key);
    if (
      expected !== undefined &&
      ((expected === null && current) ||
        (expected !== null && current?.etag !== expected))
    )
      throw new ConflictError();
    const tmp = file + "." + randomUUID();
    await writeFile(tmp, body, { mode: 0o600 });
    await rename(tmp, file);
    return digest(Buffer.from(body));
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
export async function listObjects(prefix: string) {
  safeKey(prefix);
  if (cloud()) {
    const result = await list({ prefix, limit: 1000 });
    return result.blobs.map((b) => ({
      key: b.pathname,
      date: b.uploadedAt.toISOString(),
    }));
  }
  if (process.env.VERCEL) throw new Error("Storage is not configured");
  try {
    const names = await readdir(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ localRoot(),
        prefix,
      ),
    );
    return names
      .filter((n) => n.endsWith(".json"))
      .map((n) => ({ key: prefix + n, date: n.slice(0, 24) }));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
export async function storeFile(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  safeKey(key);
  if (cloud()) {
    await put(key, Buffer.from(bytes), {
      access: "private",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
  } else {
    if (process.env.VERCEL) throw new Error("Storage is not configured");
    const file = path.join(/* turbopackIgnore: true */ localRoot(), key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeObject(key + ".meta.json", { contentType });
  }
  return key;
}
export async function readFileObject(key: string) {
  safeKey(key);
  if (cloud()) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, type: result.blob.contentType };
  }
  if (process.env.VERCEL) throw new Error("Storage is not configured");
  try {
    const data = await readFile(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ localRoot(),
        key,
      ),
    );
    const meta = await readObject<{ contentType: string }>(key + ".meta.json");
    return {
      body: new Uint8Array(data),
      type: meta?.data.contentType || "application/octet-stream",
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
