import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

function formatDate(dateIso) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${dateIso}T12:00:00`)
  );
}

async function getArchives() {
  const archiveRoot = path.join(process.cwd(), "archive");

  try {
    const entries = await readdir(archiveRoot, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    return folders.map((date) => ({
      date,
      label: formatDate(date)
    }));
  } catch {
    return [];
  }
}

export default async function ArchivesPage() {
  const archives = await getArchives();

  return (
    <main className="archive-page">
      <section className="archive-shell">
        <header className="archive-header">
          <div>
            <p className="eyebrow">Pakistan Desk</p>
            <h1>Archives</h1>
          </div>
          <a className="archive-home-link" href="/">Home</a>
        </header>

        {archives.length ? (
          <div className="archive-list">
            {archives.map((entry) => (
              <article className="archive-row" key={entry.date}>
                <div>
                  <strong>{entry.label}</strong>
                  <span>{entry.date}</span>
                </div>
                <nav aria-label={`${entry.label} archive report`}>
                  <a href={`/archives/${entry.date}`}>View</a>
                </nav>
              </article>
            ))}
          </div>
        ) : (
          <div className="archive-empty">No archived reports yet.</div>
        )}
      </section>
    </main>
  );
}
