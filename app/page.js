"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SCORE_NAMES = ["State", "Opposition", "Reform", "Security", "Civil liberties"];

function todayIso() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

function emptyReport(dateIso) {
  return {
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(
      new Date(`${dateIso}T12:00:00`)
    ),
    readTime: "Fetching latest",
    fetchWindow: "Date filter active",
    fetchedAt: "Fetching now",
    sections: ["Dawn", "The Express Tribune"].map((source) => ({
      source,
      status: "loading",
      scores: Object.fromEntries(SCORE_NAMES.map((name) => [name, 0])),
      items: []
    }))
  };
}

function ScrapingGlobe() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 430;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = "min(430px, 78vw)";
    canvas.style.height = "min(430px, 78vw)";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let tick = 0;
    const center = size / 2;
    const radius = 154;

    const nodes = [];
    for (let lat = -60; lat <= 60; lat += 15) {
      for (let lon = 0; lon < 360; lon += 18) {
        nodes.push({
          lat: (lat * Math.PI) / 180,
          lon: (lon * Math.PI) / 180,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    function project(lat, lon, rotation) {
      const rotatedLon = lon + rotation;
      const x = Math.cos(lat) * Math.sin(rotatedLon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(rotatedLon);
      return {
        x: center + x * radius,
        y: center + y * radius * 0.74,
        z
      };
    }

    function ellipse(points, alpha, width = 1) {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = `rgba(61, 242, 212, ${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function draw() {
      tick += 1;
      const rotation = tick * 0.006;
      ctx.clearRect(0, 0, size, size);

      const glow = ctx.createRadialGradient(center, center, 18, center, center, radius * 1.82);
      glow.addColorStop(0, "rgba(61,242,212,0.22)");
      glow.addColorStop(0.42, "rgba(61,242,212,0.1)");
      glow.addColorStop(0.7, "rgba(94,183,255,0.045)");
      glow.addColorStop(1, "rgba(61,242,212,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(center, center, radius * 1.86, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(center, center);
      ctx.strokeStyle = "rgba(61,242,212,0.08)";
      ctx.lineWidth = 1;
      for (let line = -4; line <= 4; line += 1) {
        ctx.beginPath();
        ctx.moveTo(-radius - 44, line * 34);
        ctx.lineTo(radius + 44, line * 34);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(line * 34, -radius - 44);
        ctx.lineTo(line * 34, radius + 44);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(tick * 0.002);
      ctx.strokeStyle = "rgba(94,183,255,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 8]);
      [radius + 18, radius + 34].forEach((ringRadius, index) => {
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = index ? "rgba(61,242,212,0.18)" : "rgba(94,183,255,0.3)";
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) {
        const inner = radius + 40;
        const outer = radius + (angle % (Math.PI / 6) < 0.001 ? 52 : 46);
        ctx.strokeStyle = "rgba(61,242,212,0.25)";
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(-0.38 + tick * 0.004);
      ctx.scale(1, 0.38);
      ctx.strokeStyle = "rgba(247,200,87,0.48)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 8, 0.15, Math.PI * 1.34);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(0.72 - tick * 0.003);
      ctx.scale(1, 0.5);
      ctx.strokeStyle = "rgba(94,183,255,0.34)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 2, Math.PI * 0.8, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();

      for (let lat = -60; lat <= 60; lat += 20) {
        const latRad = (lat * Math.PI) / 180;
        const points = [];
        for (let lon = 0; lon <= 360; lon += 3) {
          const projected = project(latRad, (lon * Math.PI) / 180, rotation);
          if (projected.z > -0.15) points.push(projected);
        }
        if (points.length > 2) ellipse(points, lat === 0 ? 0.48 : 0.22, lat === 0 ? 1.4 : 1);
      }

      for (let lon = 0; lon < 180; lon += 20) {
        const points = [];
        for (let lat = -80; lat <= 80; lat += 3) {
          const projected = project((lat * Math.PI) / 180, (lon * Math.PI) / 180, rotation);
          if (projected.z > -0.15) points.push(projected);
        }
        if (points.length > 2) ellipse(points, 0.18);
      }

      nodes.forEach((node) => {
        const projected = project(node.lat, node.lon, rotation);
        if (projected.z < -0.12) return;
        const pulse = 0.55 + Math.sin(tick * 0.04 + node.phase) * 0.35;
        ctx.fillStyle = `rgba(61, 242, 212, ${0.25 + projected.z * 0.45})`;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, Math.max(1, 1.7 + projected.z * 1.4) * pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      const pakistan = project((30.4 * Math.PI) / 180, (69.3 * Math.PI) / 180, rotation - 0.25);
      if (pakistan.z > -0.1) {
        ctx.strokeStyle = "rgba(57, 214, 111, 0.95)";
        ctx.fillStyle = "rgba(57, 214, 111, 1)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pakistan.x, pakistan.y, 13 + Math.sin(tick * 0.08) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pakistan.x, pakistan.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      const sweep = (tick * 0.018) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(247, 200, 87, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(sweep) * (radius + 30), center + Math.sin(sweep) * (radius + 30));
      ctx.stroke();

      ctx.strokeStyle = "rgba(61,242,212,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center - 18, center);
      ctx.lineTo(center + 18, center);
      ctx.moveTo(center, center - 18);
      ctx.lineTo(center, center + 18);
      ctx.stroke();

      frame = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas className="scraping-globe-canvas" ref={canvasRef} aria-hidden="true" />;
}

function LoadingReport() {
  return (
    <div className="report-loading">
      <ScrapingGlobe />
      <strong>Scraping selected print media date</strong>
      <p>Dawn and The Express Tribune are being checked by Python.</p>
    </div>
  );
}

export default function Page() {
  const maxDateIso = useMemo(() => todayIso(), []);
  const dateInputRef = useRef(null);
  const [dateIso, setDateIso] = useState(todayIso);
  const [report, setReport] = useState(() => emptyReport(todayIso()));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");

  const themes = useMemo(() => {
    const values = new Set();
    report.sections.forEach((section) => section.items.forEach((item) => values.add(item.theme)));
    return [...values].filter(Boolean).sort();
  }, [report]);

  const averages = useMemo(() => {
    return SCORE_NAMES.map((name) => {
      const total = report.sections.reduce((sum, section) => sum + Number(section.scores?.[name] || 0), 0);
      return { name, value: report.sections.length ? total / report.sections.length : 0 };
    });
  }, [report]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return report.sections
      .filter((section) => section.status !== "blocked")
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const sourceMatches = sourceFilter === "all" || section.source === sourceFilter;
          const themeMatches = themeFilter === "all" || item.theme === themeFilter;
          const text = `${section.source} ${item.title} ${item.author} ${item.summary}`.toLowerCase();
          return sourceMatches && themeMatches && text.includes(query);
        })
      }))
      .filter((section) => section.items.length);
  }, [report, search, sourceFilter, themeFilter]);

  const scrapedItemCount = useMemo(() => {
    return report.sections.reduce((total, section) => total + section.items.length, 0);
  }, [report]);

  function loadDate(targetDate) {
    if (!targetDate || targetDate > maxDateIso) return;
    setDateIso(targetDate);
    fetchReport(targetDate);
  }

  function applySelectedDate() {
    loadDate(dateInputRef.current?.value || dateIso);
  }

  function openArchives() {
    window.open("/archives", "_blank", "noopener,noreferrer");
  }

  async function fetchReport(targetDate = dateIso, options = {}) {
    const refresh = options.refresh === true;
    setLoading(true);
    setStatus(refresh ? "Scraping" : "Loading");
    setReport(emptyReport(targetDate));
    try {
      const query = new URLSearchParams({ date: targetDate });
      if (refresh) query.set("refresh", "1");
      const response = await fetch(`/api/report?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Report fetch failed");
      setReport(data);
      const cacheState = response.headers.get("X-Report-Cache");
      const liveCount = data.sections.filter((section) => section.status === "scraped").length;
      const itemCount = data.sections.reduce((total, section) => total + section.items.length, 0);
      const statusPrefix = cacheState === "hit" || cacheState === "stale" ? "Cached" : "Scraped";
      setStatus(itemCount ? `${statusPrefix} ${liveCount}/3` : "No articles for date");
      setSourceFilter("all");
      setThemeFilter("all");
    } catch (error) {
      setStatus("Scrape failed");
      setReport({
        ...emptyReport(targetDate),
        fetchedAt: error.message,
        sections: [
          {
            source: "Python scraper",
            status: "blocked",
            scores: Object.fromEntries(SCORE_NAMES.map((name) => [name, 0])),
            items: [
              {
                title: "Scrape failed",
                author: "Python",
                theme: "State",
                tone: "critical",
                summary: error.message
              }
            ]
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport(dateIso);
  }, []);

  function printReport() {
    window.print();
  }

  function savePdf() {
    const original = document.title;
    const pdfTitle = `Pakistan-Print-Media-Review-${dateIso}`;
    document.title = pdfTitle;
    if (window.PrintMediaReviewAndroid?.savePdf) {
      window.PrintMediaReviewAndroid.savePdf(pdfTitle);
      setTimeout(() => {
        document.title = original;
      }, 700);
      return;
    }
    window.print();
    setTimeout(() => {
      document.title = original;
    }, 700);
  }

  function downloadWord() {
    const documentHtml = document.querySelector("#reportDocument").outerHTML;
    const styles = document.querySelector("style")?.innerHTML || "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${documentHtml}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Pakistan-Print-Media-Review-${dateIso}.doc`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const loadingCopy =
    status === "Scraping"
      ? {
          title: "Scraping selected print media date",
          body: "Dawn and The Express Tribune are being checked by Python."
        }
      : {
          title: "Loading selected print media date",
          body: "Opening the archived report for the selected date."
        };

  return (
    <>
      <div className="page-grid" />
      {loading ? (
        <div className="scrape-overlay" role="status" aria-live="polite">
          <ScrapingGlobe />
          <strong>{loadingCopy.title}</strong>
          <p>{loadingCopy.body}</p>
        </div>
      ) : null}
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#" aria-label="Pakistan Print Media Review">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>Print Media Review</strong>
              <small>Pakistan Desk</small>
            </span>
          </a>

          <nav className="module-tabs" aria-label="Modules">
            <button className="tab active" type="button">Print Review</button>
            <button className="tab" type="button" disabled>Policy Brief</button>
            <button className="tab" type="button" disabled>Media Watch</button>
          </nav>

          <div className="actions topbar-actions">
            <button className="action-button" type="button" onClick={() => fetchReport(dateIso, { refresh: true })} disabled={loading}>
              <span>Fetch</span>
            </button>
            <button className="action-button topbar-export-action" type="button" onClick={savePdf}>
              <span>Save PDF</span>
            </button>
            <button className="action-button topbar-export-action" type="button" onClick={downloadWord}>
              <span>Word</span>
            </button>
            <button className="action-button topbar-export-action" type="button" onClick={printReport}>
              <span>Print Report</span>
            </button>
          </div>
        </header>

        <main className="workspace">
          <aside className="side-panel" aria-label="Report controls">
            <section className="module-card">
              <div className="module-kicker">Module 01</div>
              <h1>Print Media Review</h1>
              <p>Daily Pakistan print media report.</p>
              <div className="date-block">
                <span>{report.date}</span>
                <strong>{report.readTime}</strong>
                <small>{report.fetchWindow}</small>
                <small>{report.fetchedAt}</small>
              </div>
            </section>

            <section className="source-panel" aria-label="Source status">
              <div className="panel-heading">
                <span>Python Sources</span>
                <strong>{report.sections.filter((section) => section.status === "scraped").length}/3</strong>
              </div>
              <div className="source-status">
                {report.sections.map((section) => (
                  <div
                    className={`source-chip ${section.status === "scraped" ? "ok" : section.status === "blocked" ? "fail" : ""}`}
                    key={section.source}
                  >
                    <span />
                    <strong>{section.source}</strong>
                    <em>{section.status}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="control-panel">
              <label htmlFor="reportDateInput">Report date</label>
              <input
                id="reportDateInput"
                ref={dateInputRef}
                type="date"
                max={maxDateIso}
                value={dateIso}
                onInput={(event) => setDateIso(event.currentTarget.value)}
                onChange={(event) => setDateIso(event.currentTarget.value)}
              />
              <div className="date-action-row">
                <button type="button" onClick={applySelectedDate} disabled={loading}>
                  Apply Date
                </button>
                <button type="button" onClick={openArchives}>
                  Archives
                </button>
              </div>

              <label htmlFor="searchInput">Search</label>
              <input id="searchInput" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />

              <label htmlFor="sourceFilter">Newspaper</label>
              <select id="sourceFilter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">All newspapers</option>
                {report.sections.map((section) => (
                  <option key={section.source} value={section.source}>{section.source}</option>
                ))}
              </select>

              <label htmlFor="themeFilter">Theme</label>
              <select id="themeFilter" value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}>
                <option value="all">All themes</option>
                {themes.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </section>

            <section className="score-panel" aria-label="Comparative score overview">
              <div className="panel-heading">
                <span>Score Lens</span>
                <strong>0-5</strong>
              </div>
              <div className="score-bars">
                {averages.map(({ name, value }) => (
                  <div className="score-row" key={name}>
                    <div className="score-label">
                      <span>{name}</span>
                      <strong>{formatScore(value)}</strong>
                    </div>
                    <div className="meter"><span style={{ width: `${Math.min(100, (value / 5) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="report-panel" aria-labelledby="reportTitle">
            <div className="report-toolbar">
              <div className="report-toolbar-main">
                <div>
                  <p className="eyebrow">Pakistan Only</p>
                  <h2 id="reportTitle">Print Media Review</h2>
                </div>
                <div className="status-pill">
                  <span />
                  <strong>{status}</strong>
                </div>
              </div>
              <div className="document-actions" aria-label="Document file actions">
                <button type="button" onClick={savePdf}>
                  Save PDF
                </button>
                <button type="button" onClick={downloadWord}>
                  Word
                </button>
                <button type="button" onClick={printReport}>
                  Print
                </button>
              </div>
            </div>

            <article className={`report-document ${loading ? "is-loading" : ""}`} id="reportDocument">
              <header className="document-header">
                <h2>Print Media Review</h2>
                <p><span>{report.date}</span>, <span>{report.readTime}</span></p>
                <p className="document-fetch-meta"><span>{report.fetchWindow}</span>; <span>{report.fetchedAt}</span></p>
              </header>

              {loading ? (
                <LoadingReport />
              ) : filteredSections.length ? (
                filteredSections.map((section) => (
                  <section className="source-section" key={section.source}>
                    <h3 className="source-heading">{section.source}</h3>
                    <p className="score-line">
                      <strong>Comparative score line:</strong>{" "}
                      {SCORE_NAMES.map((name, index) => (
                        <span key={name}>
                          <strong>{name}</strong> {formatScore(section.scores?.[name])}
                          {index < SCORE_NAMES.length - 1 ? " | " : ""}
                        </span>
                      ))}
                    </p>
                    <ul className="review-list">
                      {section.items.map((item) => (
                        <li key={`${section.source}-${item.title}-${item.url || item.summary}`}>
                          <span className={`article-title ${item.tone === "positive" ? "positive" : ""}`}>{item.title}</span>,{" "}
                          <span className="author">{item.author}</span>, {item.summary}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              ) : scrapedItemCount ? (
                <div className="empty-state">No matching review items.</div>
              ) : (
                <div className="empty-state empty-state-action">
                  <strong>No articles found for {report.date}.</strong>
                  <span>Today&apos;s articles may not be uploaded yet.</span>
                </div>
              )}
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
