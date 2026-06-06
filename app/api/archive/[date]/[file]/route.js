import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTENT_TYPES = {
  "report.json": "application/json; charset=utf-8",
  "report.txt": "text/plain; charset=utf-8"
};

export async function GET(_request, context) {
  const { date, file } = await context.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !CONTENT_TYPES[file]) {
    return new Response("Archive file not found", { status: 404 });
  }

  try {
    const archivePath = path.join(process.cwd(), "archive", date, file);
    const content = await readFile(archivePath);

    return new Response(content, {
      headers: {
        "Content-Type": CONTENT_TYPES[file],
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return new Response("Archive file not found", { status: 404 });
  }
}
