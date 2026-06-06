import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import sampleReport from "./src/sampleReport";

const SCORE_NAMES = ["State", "Opposition", "Reform", "Security", "Civil liberties"];
const SOURCES = ["Dawn", "The News International", "The Express Tribune"];
const API_BASE =
  process.env.EXPO_PUBLIC_REPORT_API_BASE_URL ||
  Platform.select({
    android: "http://10.0.2.2:3000",
    ios: "http://localhost:3000",
    default: ""
  });

function todayIso() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function displayDate(dateIso) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateIso}T12:00:00`));
}

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

function emptyScores() {
  return Object.fromEntries(SCORE_NAMES.map((name) => [name, 0]));
}

function emptyReport(dateIso) {
  return {
    date: displayDate(dateIso),
    readTime: "Fetching latest",
    fetchWindow: `Date filter: only ${displayDate(dateIso)} articles/op-eds`,
    fetchedAt: "Fetching now",
    sections: SOURCES.map((source) => ({
      source,
      status: "loading",
      scores: emptyScores(),
      items: []
    }))
  };
}

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function safeFileName(value) {
  return value.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTextReport(report) {
  const lines = [
    "Print Media Review",
    `${report.date}, ${report.readTime}`,
    `${report.fetchWindow}; ${report.fetchedAt}`,
    ""
  ];

  for (const section of report.sections || []) {
    if (section.status === "blocked") {
      continue;
    }
    lines.push(section.source);
    lines.push(
      `Comparative score line: ${SCORE_NAMES.map((name) => `${name} ${formatScore(section.scores?.[name])}`).join(" | ")}`
    );
    for (const item of section.items || []) {
      lines.push(`- ${item.title}, ${item.author}, ${item.summary}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildReportHtml(report) {
  const sections = (report.sections || [])
    .filter((section) => section.status !== "blocked")
    .map((section) => {
      const items = (section.items || [])
        .map(
          (item) =>
            `<li><strong class="${item.tone === "positive" ? "positive" : ""}">${escapeHtml(item.title)}</strong>, <b>${escapeHtml(
              item.author
            )}</b>, ${escapeHtml(item.summary)}</li>`
        )
        .join("");
      const scores = SCORE_NAMES.map((name) => `<b>${escapeHtml(name)}</b> ${formatScore(section.scores?.[name])}`).join(" | ");
      return `<section><h2>${escapeHtml(section.source)}</h2><p><b>Comparative score line:</b> ${scores}</p><ul>${items}</ul></section>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #161718; margin: 28px; }
      h1 { color: #24465d; margin: 0 0 4px; font-size: 30px; }
      h2 { color: #24465d; margin: 16px 0 4px; font-size: 22px; }
      p { margin: 2px 0 6px; line-height: 1.28; }
      ul { margin: 0 0 0 18px; padding: 0; }
      li { margin: 0 0 5px; line-height: 1.24; text-align: justify; }
      strong { color: #b01620; }
      strong.positive { color: #128020; }
      .meta { border-bottom: 1px solid #24465d; padding-bottom: 8px; }
    </style>
  </head>
  <body>
    <h1>Print Media Review</h1>
    <div class="meta">
      <p>${escapeHtml(report.date)}, ${escapeHtml(report.readTime)}</p>
      <p>${escapeHtml(report.fetchWindow)}; ${escapeHtml(report.fetchedAt)}</p>
    </div>
    ${sections}
  </body>
</html>`;
}

function StatusDot({ status }) {
  const color = status === "scraped" || status === "sample" ? "#39d66f" : status === "blocked" ? "#ff4d5e" : "#f7c857";
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

function GlobeLoader() {
  return (
    <View style={styles.globeShell}>
      <View style={styles.globeOuter}>
        <View style={styles.globeLine} />
        <View style={[styles.globeLine, styles.globeLineVertical]} />
        <View style={styles.globeEquator} />
        <View style={[styles.globeEquator, styles.globeEquatorSmall]} />
        <View style={styles.globeMarker} />
      </View>
    </View>
  );
}

function Chip({ active, children, onPress, tone = "default" }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        tone === "danger" ? styles.chipDanger : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
        {children}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const maxDateIso = useMemo(() => todayIso(), []);
  const [dateIso, setDateIso] = useState(todayIso());
  const [dateDraft, setDateDraft] = useState(todayIso());
  const [report, setReport] = useState(() => emptyReport(todayIso()));
  const [status, setStatus] = useState("Loading");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [archives, setArchives] = useState([{ date: sampleReport.dateIso, label: sampleReport.report.date }]);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const themes = useMemo(() => {
    const values = new Set();
    report.sections.forEach((section) => section.items.forEach((item) => item.theme && values.add(item.theme)));
    return [...values].sort();
  }, [report]);

  const averages = useMemo(() => {
    return SCORE_NAMES.map((name) => {
      const total = report.sections.reduce((sum, section) => sum + Number(section.scores?.[name] || 0), 0);
      return {
        name,
        value: report.sections.length ? total / report.sections.length : 0
      };
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
          const text = `${section.source} ${item.title} ${item.author} ${item.theme} ${item.summary}`.toLowerCase();
          return sourceMatches && themeMatches && text.includes(query);
        })
      }))
      .filter((section) => section.items.length);
  }, [report, search, sourceFilter, themeFilter]);

  const itemCount = useMemo(() => {
    return report.sections.reduce((total, section) => total + section.items.length, 0);
  }, [report]);

  async function fetchArchives(options = {}) {
    try {
      const response = await fetch(apiUrl("/api/archives"), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.archives)) {
        throw new Error("Archive index unavailable");
      }
      if (data.archives.length) {
        setArchives(data.archives);
      }
    } catch {
      setArchives([{ date: sampleReport.dateIso, label: sampleReport.report.date }]);
    } finally {
      if (options.open) {
        setArchiveOpen(true);
      }
    }
  }

  async function fetchReport(targetDate = dateIso, options = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }
    if (targetDate > maxDateIso) {
      Alert.alert("Future date", "Pick today or an earlier date.");
      return;
    }

    const refresh = options.refresh === true;
    setDateIso(targetDate);
    setDateDraft(targetDate);
    setLoading(true);
    setStatus(refresh ? "Live fetching" : "Loading");
    setReport(emptyReport(targetDate));

    try {
      const query = `date=${encodeURIComponent(targetDate)}${refresh ? "&refresh=1" : ""}`;
      const response = await fetch(apiUrl(`/api/report?${query}`), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.sections)) {
        throw new Error(data.detail || data.error || "Report fetch failed");
      }
      const liveCount = data.sections.filter((section) => section.status === "scraped").length;
      const total = data.sections.reduce((sum, section) => sum + section.items.length, 0);
      setReport(data);
      setStatus(total ? `${refresh ? "Live" : "Loaded"} ${liveCount}/3` : "No articles");
      setSourceFilter("all");
      setThemeFilter("all");
      setArchiveOpen(false);
      fetchArchives();
    } catch (error) {
      if (targetDate === sampleReport.dateIso) {
        setReport(sampleReport.report);
        setStatus("Sample offline");
      } else {
        setReport({
          ...emptyReport(targetDate),
          readTime: "Unavailable",
          fetchedAt: error.message,
          sections: [
            {
              source: "Report service",
              status: "blocked",
              scores: emptyScores(),
              items: []
            }
          ]
        });
        setStatus("Offline");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArchives();
    fetchReport(dateIso, { refresh: true });
  }, []);

  function openArchivePanel() {
    setArchiveOpen((value) => !value);
    fetchArchives({ open: true });
  }

  async function openUrl(url) {
    if (!url) {
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    }
  }

  async function shareTextReport() {
    await Share.share({
      title: `Print Media Review - ${report.date}`,
      message: buildTextReport(report)
    });
  }

  async function savePdf() {
    try {
      const html = buildReportHtml(report);
      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: `Print Media Review - ${report.date}`
      });
    } catch (error) {
      Alert.alert("PDF export failed", error.message);
    }
  }

  async function saveWord() {
    try {
      const html = buildReportHtml(report);
      const fileName = `Pakistan-Print-Media-Review-${safeFileName(dateIso)}.doc`;
      const uri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: "application/msword",
        dialogTitle: `Print Media Review - ${report.date}`
      });
    } catch (error) {
      Alert.alert("Word export failed", error.message);
    }
  }

  async function printReport() {
    try {
      await Print.printAsync({ html: buildReportHtml(report) });
    } catch (error) {
      Alert.alert("Print failed", error.message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#07090c" />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <GlobeLoader />
          <Text style={styles.loadingTitle}>{status === "Live fetching" ? "Fetching real-time report" : "Loading report"}</Text>
          <Text style={styles.loadingBody}>The live scraper is checking Dawn, The News International, and The Express Tribune.</Text>
        </View>
      ) : null}

      <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <View style={styles.brandMarkInner} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandTitle}>Print Media Review</Text>
              <Text style={styles.brandSub}>Pakistan Desk</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Chip active={false} onPress={() => fetchReport(dateIso, { refresh: true })}>
              Live Fetch
            </Chip>
            <Chip active={archiveOpen} onPress={openArchivePanel}>
              Archive
            </Chip>
            <Chip active={false} onPress={savePdf}>
              PDF
            </Chip>
            <Chip active={false} onPress={saveWord}>
              Word
            </Chip>
            <Chip active={false} onPress={printReport}>
              Print
            </Chip>
          </View>
        </View>

        <View style={styles.moduleCard}>
          <Text style={styles.kicker}>Module 01</Text>
          <Text style={styles.moduleTitle}>Print Media Review</Text>
          <Text style={styles.moduleBody}>Daily Pakistan print media report.</Text>
          <View style={styles.dateBlock}>
            <Text style={styles.dateText}>{report.date}</Text>
            <Text style={styles.metaText}>{report.readTime}</Text>
            <Text style={styles.mutedText}>{report.fetchWindow}</Text>
            <Text style={styles.mutedText}>{report.fetchedAt}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>Sources</Text>
            <Text style={styles.panelCount}>
              {report.sections.filter((section) => section.status === "scraped" || section.status === "sample").length}/3
            </Text>
          </View>
          <View style={styles.sourceGrid}>
            {report.sections.map((section) => (
              <View style={styles.sourceChip} key={section.source}>
                <StatusDot status={section.status} />
                <Text style={styles.sourceName} numberOfLines={1}>
                  {section.source}
                </Text>
                <Text style={styles.sourceState}>{section.status}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Report date</Text>
          <View style={styles.dateRow}>
            <TextInput
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#607477"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
            <Pressable style={styles.applyButton} onPress={() => fetchReport(dateDraft)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Chip active={dateIso === maxDateIso} onPress={() => fetchReport(maxDateIso)}>
              Today
            </Chip>
            <Chip active={false} onPress={() => fetchReport(dateIso, { refresh: true })}>
              Fetch Live
            </Chip>
            <Chip active={archiveOpen} onPress={openArchivePanel}>
              Archive
            </Chip>
            {archives.slice(0, 4).map((archive) => (
              <Chip active={dateIso === archive.date} key={archive.date} onPress={() => fetchReport(archive.date)}>
                {archive.date}
              </Chip>
            ))}
          </View>

          {archiveOpen ? (
            <View style={styles.archivePanel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>Archive</Text>
                <Pressable onPress={() => fetchArchives({ open: true })} style={({ pressed }) => [styles.inlineButton, pressed ? styles.pressed : null]}>
                  <Text style={styles.inlineButtonText}>Refresh</Text>
                </Pressable>
              </View>
              {archives.length ? (
                archives.map((archive) => (
                  <Pressable
                    key={archive.date}
                    onPress={() => fetchReport(archive.date)}
                    style={({ pressed }) => [styles.archiveRow, dateIso === archive.date ? styles.archiveRowActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.archiveDate}>{archive.label || archive.date}</Text>
                    <Text style={styles.archiveIso}>{archive.date}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.mutedText}>No archived reports yet.</Text>
              )}
            </View>
          ) : null}

          <Text style={styles.label}>Search</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Topic, author, newspaper"
            placeholderTextColor="#607477"
            style={styles.input}
          />

          <Text style={styles.label}>Newspaper</Text>
          <View style={styles.chipRow}>
            <Chip active={sourceFilter === "all"} onPress={() => setSourceFilter("all")}>
              All
            </Chip>
            {report.sections.map((section) => (
              <Chip active={sourceFilter === section.source} key={section.source} onPress={() => setSourceFilter(section.source)}>
                {section.source}
              </Chip>
            ))}
          </View>

          <Text style={styles.label}>Theme</Text>
          <View style={styles.chipRow}>
            <Chip active={themeFilter === "all"} onPress={() => setThemeFilter("all")}>
              All
            </Chip>
            {themes.map((theme) => (
              <Chip active={themeFilter === theme} key={theme} onPress={() => setThemeFilter(theme)}>
                {theme}
              </Chip>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>Score Lens</Text>
            <Text style={styles.panelCount}>0-5</Text>
          </View>
          {averages.map(({ name, value }) => (
            <View style={styles.scoreRow} key={name}>
              <View style={styles.scoreLabelRow}>
                <Text style={styles.scoreName}>{name}</Text>
                <Text style={styles.scoreValue}>{formatScore(value)}</Text>
              </View>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${Math.min(100, (value / 5) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reportToolbar}>
          <View>
            <Text style={styles.kicker}>Pakistan Only</Text>
            <Text style={styles.reportTitle}>Print Media Review</Text>
          </View>
          <View style={styles.statusPill}>
            <StatusDot status={status === "Offline" ? "blocked" : "scraped"} />
            <Text style={styles.statusPillText}>{status}</Text>
          </View>
        </View>

        <View style={styles.document}>
          <Text style={styles.documentTitle}>Print Media Review</Text>
          <Text style={styles.documentMeta}>
            {report.date}, {report.readTime}
          </Text>
          <Text style={styles.documentFetch}>
            {report.fetchWindow}; {report.fetchedAt}
          </Text>

          {filteredSections.length ? (
            filteredSections.map((section) => (
              <View style={styles.documentSection} key={section.source}>
                <Text style={styles.sourceHeading}>{section.source}</Text>
                <Text style={styles.scoreLine}>
                  <Text style={styles.scoreLead}>Comparative score line: </Text>
                  {SCORE_NAMES.map((name, index) => `${name} ${formatScore(section.scores?.[name])}${index < SCORE_NAMES.length - 1 ? " | " : ""}`).join("")}
                </Text>
                {(section.items || []).map((item) => (
                  <Pressable key={`${section.source}-${item.title}-${item.url || item.summary}`} onPress={() => openUrl(item.url)}>
                    <Text style={styles.reviewItem}>
                      <Text style={item.tone === "positive" ? styles.positiveTitle : styles.criticalTitle}>{item.title}</Text>
                      <Text>, </Text>
                      <Text style={styles.author}>{item.author}</Text>
                      <Text>, {item.summary}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))
          ) : itemCount ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No matching review items.</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No articles found for {report.date}.</Text>
              <Text style={styles.emptySubtext}>Today's articles may not be uploaded yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomActions}>
          <Chip active={false} onPress={shareTextReport}>
            Share Text
          </Chip>
          <Chip active={false} onPress={savePdf}>
            Save PDF
          </Chip>
          <Chip active={false} onPress={saveWord}>
            Word
          </Chip>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07090c"
  },
  screen: {
    flex: 1,
    backgroundColor: "#07090c"
  },
  screenContent: {
    padding: 14,
    paddingBottom: 34
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "rgba(4, 9, 12, 0.96)"
  },
  loadingTitle: {
    marginTop: 18,
    color: "#ecf8f5",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
  },
  loadingBody: {
    marginTop: 8,
    maxWidth: 320,
    color: "#93a8aa",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center"
  },
  globeShell: {
    width: 190,
    height: 190,
    alignItems: "center",
    justifyContent: "center"
  },
  globeOuter: {
    width: 156,
    height: 156,
    borderWidth: 2,
    borderColor: "#3df2d4",
    borderRadius: 78,
    shadowColor: "#3df2d4",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8
  },
  globeLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 76,
    height: 1,
    backgroundColor: "rgba(61, 242, 212, 0.45)"
  },
  globeLineVertical: {
    left: 76,
    right: "auto",
    top: 16,
    width: 1,
    height: 124
  },
  globeEquator: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 50,
    height: 56,
    borderWidth: 1,
    borderColor: "rgba(94, 183, 255, 0.48)",
    borderRadius: 40
  },
  globeEquatorSmall: {
    left: 54,
    right: 54,
    top: 12,
    height: 132,
    borderColor: "rgba(61, 242, 212, 0.42)"
  },
  globeMarker: {
    position: "absolute",
    right: 47,
    top: 58,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#39d66f",
    backgroundColor: "rgba(57, 214, 111, 0.4)"
  },
  header: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(78, 249, 216, 0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(12, 18, 22, 0.92)"
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0
  },
  brandMark: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#3df2d4"
  },
  brandMarkInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(61, 242, 212, 0.55)"
  },
  brandText: {
    flex: 1,
    marginLeft: 12
  },
  brandTitle: {
    color: "#ecf8f5",
    fontSize: 20,
    fontWeight: "900"
  },
  brandSub: {
    marginTop: 2,
    color: "#3df2d4",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12
  },
  moduleCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.045)"
  },
  kicker: {
    color: "#3df2d4",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  moduleTitle: {
    marginTop: 8,
    color: "#ecf8f5",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900"
  },
  moduleBody: {
    marginTop: 8,
    color: "#93a8aa",
    fontSize: 15,
    lineHeight: 22
  },
  dateBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.09)"
  },
  dateText: {
    color: "#f7c857",
    fontSize: 16,
    fontWeight: "900"
  },
  metaText: {
    marginTop: 5,
    color: "#ecf8f5",
    fontSize: 14,
    fontWeight: "700"
  },
  mutedText: {
    marginTop: 4,
    color: "#93a8aa",
    fontSize: 12,
    lineHeight: 17
  },
  panel: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(78, 249, 216, 0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(12, 18, 22, 0.88)"
  },
  panelHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  panelTitle: {
    color: "#93a8aa",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  panelCount: {
    color: "#f7c857",
    fontSize: 13,
    fontWeight: "900"
  },
  sourceGrid: {
    marginTop: -8
  },
  sourceChip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    backgroundColor: "rgba(2, 8, 10, 0.62)"
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  sourceName: {
    flex: 1,
    marginLeft: 8,
    color: "#ecf8f5",
    fontSize: 13,
    fontWeight: "800"
  },
  sourceState: {
    marginLeft: 8,
    color: "#93a8aa",
    fontSize: 12,
    fontStyle: "italic"
  },
  label: {
    marginTop: 12,
    marginBottom: 7,
    color: "#93a8aa",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dateRow: {
    flexDirection: "row"
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 6,
    backgroundColor: "rgba(2, 8, 10, 0.78)",
    color: "#ecf8f5",
    fontSize: 15
  },
  applyButton: {
    minHeight: 46,
    justifyContent: "center",
    marginLeft: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    backgroundColor: "#3df2d4"
  },
  applyButtonText: {
    color: "#021512",
    fontSize: 14,
    fontWeight: "900"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    marginLeft: -8
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(61, 242, 212, 0.35)",
    borderRadius: 8,
    backgroundColor: "rgba(61, 242, 212, 0.08)"
  },
  chipActive: {
    backgroundColor: "#3df2d4",
    borderColor: "#3df2d4"
  },
  chipDanger: {
    borderColor: "rgba(255, 77, 94, 0.45)"
  },
  chipText: {
    maxWidth: 190,
    color: "#3df2d4",
    fontSize: 13,
    fontWeight: "900"
  },
  chipTextActive: {
    color: "#021512"
  },
  inlineButton: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(61, 242, 212, 0.35)",
    borderRadius: 6,
    backgroundColor: "rgba(61, 242, 212, 0.08)"
  },
  inlineButtonText: {
    color: "#3df2d4",
    fontSize: 12,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.72
  },
  archivePanel: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(247, 200, 87, 0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(247, 200, 87, 0.06)"
  },
  archiveRow: {
    minHeight: 46,
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    backgroundColor: "rgba(2, 8, 10, 0.62)"
  },
  archiveRowActive: {
    borderColor: "rgba(61, 242, 212, 0.72)",
    backgroundColor: "rgba(61, 242, 212, 0.1)"
  },
  archiveDate: {
    color: "#ecf8f5",
    fontSize: 14,
    fontWeight: "900"
  },
  archiveIso: {
    marginTop: 2,
    color: "#93a8aa",
    fontSize: 12,
    fontWeight: "700"
  },
  scoreRow: {
    marginTop: 10
  },
  scoreLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  scoreName: {
    color: "#ecf8f5",
    fontSize: 13,
    fontWeight: "800"
  },
  scoreValue: {
    color: "#ecf8f5",
    fontSize: 13,
    fontWeight: "900"
  },
  meter: {
    height: 8,
    marginTop: 6,
    overflow: "hidden",
    borderRadius: 99,
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  meterFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#39d66f"
  },
  reportToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10
  },
  reportTitle: {
    marginTop: 4,
    color: "#ecf8f5",
    fontSize: 24,
    fontWeight: "900"
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(57, 214, 111, 0.3)",
    borderRadius: 999,
    backgroundColor: "rgba(57, 214, 111, 0.08)"
  },
  statusPillText: {
    marginLeft: 8,
    color: "#39d66f",
    fontSize: 13,
    fontWeight: "900"
  },
  document: {
    minHeight: 560,
    padding: 16,
    borderRadius: 3,
    backgroundColor: "#f9fbfa"
  },
  documentTitle: {
    color: "#24465d",
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900"
  },
  documentMeta: {
    marginTop: 4,
    color: "#151515",
    fontSize: 15,
    fontWeight: "700"
  },
  documentFetch: {
    marginTop: 3,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#24465d",
    color: "#4c5558",
    fontSize: 12,
    lineHeight: 17
  },
  documentSection: {
    marginTop: 10
  },
  sourceHeading: {
    color: "#24465d",
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900"
  },
  scoreLine: {
    marginTop: 2,
    color: "#101010",
    fontSize: 15,
    lineHeight: 21
  },
  scoreLead: {
    color: "#b01620",
    fontWeight: "900"
  },
  reviewItem: {
    marginTop: 5,
    color: "#161718",
    fontSize: 16,
    lineHeight: 22
  },
  positiveTitle: {
    color: "#128020",
    fontWeight: "900"
  },
  criticalTitle: {
    color: "#b01620",
    fontWeight: "900"
  },
  author: {
    fontWeight: "900"
  },
  emptyState: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  emptyText: {
    color: "#24465d",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  emptySubtext: {
    marginTop: 8,
    color: "#4c5558",
    fontSize: 13,
    textAlign: "center"
  },
  bottomActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginLeft: -8
  }
});
