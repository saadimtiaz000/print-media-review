import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(dateIso) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateIso}T12:00:00`));
}

export async function GET() {
  const archiveRoot = path.join(process.cwd(), "archive");

  try {
    const entries = await readdir(archiveRoot, { withFileTypes: true });
    const archives = entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => ({
        date: entry.name,
        label: formatDate(entry.name)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return Response.json(
      { archives },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json({ archives: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
