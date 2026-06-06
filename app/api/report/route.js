import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const scrapeJobs = globalThis.__printMediaScrapeJobs || new Map();
globalThis.__printMediaScrapeJobs = scrapeJobs;

function runPythonScraper(date) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scrapers", "press_scraper.py");
    const localPython = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", "Python", "Python314", "python.exe")
      : null;
    const pythonCandidates = [
      process.env.PYTHON_PATH,
      localPython,
      "python",
      "py"
    ].filter(Boolean);

    let index = 0;

    function tryNext(lastError = null) {
      if (index >= pythonCandidates.length) {
        reject(lastError || new Error("Python executable not found"));
        return;
      }

      const python = pythonCandidates[index];
      index += 1;
      const child = spawn(python, [scriptPath, "--date", date], {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        tryNext(error);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          tryNext(new Error(stderr || `Python exited with code ${code}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          reject(new Error(`Invalid scraper JSON: ${error.message}\n${stdout}\n${stderr}`));
        }
      });
    }

    tryNext();
  });
}

async function loadArchivedReport(date) {
  const reportPath = path.join(process.cwd(), "archive", date, "report.json");
  const contents = await readFile(reportPath, "utf8");
  return JSON.parse(contents);
}

function buildTextReport(report) {
  const lines = [
    "Print Media Review",
    `${report.date}, ${report.readTime}`,
    `${report.fetchWindow}; ${report.fetchedAt}`,
    ""
  ];

  for (const section of report.sections || []) {
    lines.push(section.source);
    lines.push(
      `Comparative score line: State ${section.scores?.State ?? 0} | Opposition ${section.scores?.Opposition ?? 0} | Reform ${section.scores?.Reform ?? 0} | Security ${section.scores?.Security ?? 0} | Civil liberties ${section.scores?.["Civil liberties"] ?? 0}`
    );

    if (section.items?.length) {
      for (const item of section.items) {
        lines.push(`- ${item.title}, ${item.author}, ${item.summary}`);
      }
    } else {
      lines.push(`- No matching articles archived. ${section.error || "Source unavailable for selected date."}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

async function archiveReport(date, report) {
  const relativeFolder = path.join("archive", date);
  const archiveFolder = path.join(process.cwd(), relativeFolder);
  const archivedAt = new Date().toISOString();
  const archivedReport = {
    ...report,
    archive: {
      folder: relativeFolder.replaceAll("\\", "/"),
      files: ["report.json", "report.txt"],
      archivedAt
    }
  };

  await mkdir(archiveFolder, { recursive: true });
  await writeFile(path.join(archiveFolder, "report.json"), JSON.stringify(archivedReport, null, 2), "utf8");
  await writeFile(path.join(archiveFolder, "report.txt"), buildTextReport(archivedReport), "utf8");

  return archivedReport;
}

function scrapeAndArchive(date) {
  if (scrapeJobs.has(date)) {
    return scrapeJobs.get(date);
  }

  const job = runPythonScraper(date)
    .then((report) => archiveReport(date, report))
    .finally(() => {
      scrapeJobs.delete(date);
    });
  scrapeJobs.set(date, job);
  return job;
}

function jsonReport(report, cacheState) {
  return Response.json(report, {
    headers: {
      "Cache-Control": "no-store",
      "X-Report-Cache": cacheState
    }
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const refresh = searchParams.get("refresh") === "1";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  if (!refresh) {
    try {
      return jsonReport(await loadArchivedReport(date), "hit");
    } catch {
      // No archived report yet, so fall through to a live scrape.
    }
  }

  try {
    return jsonReport(await scrapeAndArchive(date), refresh ? "refresh" : "miss");
  } catch (error) {
    if (refresh) {
      try {
        return jsonReport(await loadArchivedReport(date), "stale");
      } catch {
        // No stale copy exists, so return the scraper failure below.
      }
    }

    return Response.json(
      {
        error: "Python scraper failed",
        detail: error.message
      },
      { status: 500 }
    );
  }
}
