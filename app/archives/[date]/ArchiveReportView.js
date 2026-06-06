"use client";

const SCORE_NAMES = ["State", "Opposition", "Reform", "Security", "Civil liberties"];

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

export default function ArchiveReportView({ report, date }) {
  function printReport() {
    window.print();
  }

  function savePdf() {
    const original = document.title;
    document.title = `Pakistan-Print-Media-Review-${date}`;
    window.print();
    setTimeout(() => {
      document.title = original;
    }, 700);
  }

  function downloadWord() {
    const documentHtml = document.querySelector("#archiveReportDocument").outerHTML;
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${documentHtml}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Pakistan-Print-Media-Review-${date}.doc`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="archive-actions">
        <button type="button" onClick={() => history.back()}>Back</button>
        <a href="/">Home</a>
        <a href="/archives">Archives</a>
        <button type="button" onClick={savePdf}>Save PDF</button>
        <button type="button" onClick={downloadWord}>Word</button>
        <button type="button" onClick={printReport}>Print</button>
      </div>

      <article className="report-document" id="archiveReportDocument">
        <header className="document-header">
          <h2>Print Media Review</h2>
          <p><span>{report.date}</span>, <span>{report.readTime}</span></p>
          <p className="document-fetch-meta"><span>{report.fetchWindow}</span>; <span>{report.fetchedAt}</span></p>
        </header>

        {(report.sections || [])
          .filter((section) => section.status !== "blocked")
          .map((section) => (
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
                {(section.items || []).map((item) => (
                  <li key={`${section.source}-${item.title}-${item.url || item.summary}`}>
                    <span className={`article-title ${item.tone === "positive" ? "positive" : ""}`}>{item.title}</span>,{" "}
                    <span className="author">{item.author}</span>, {item.summary}
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </article>
    </>
  );
}
