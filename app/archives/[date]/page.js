import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import ArchiveReportView from "./ArchiveReportView";

export const dynamic = "force-dynamic";

async function loadArchivedReport(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  try {
    const filePath = path.join(process.cwd(), "archive", date, "report.json");
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    notFound();
  }
}

export default async function ArchiveDatePage({ params }) {
  const { date } = await params;
  const report = await loadArchivedReport(date);

  return (
    <main className="archive-page archive-report-page">
      <section className="archive-shell archive-view-shell">
        <ArchiveReportView report={report} date={date} />
      </section>
    </main>
  );
}
