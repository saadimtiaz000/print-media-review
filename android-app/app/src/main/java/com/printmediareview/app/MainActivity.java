package com.printmediareview.app;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;

public class MainActivity extends Activity {
    private static final String[] SCORE_NAMES = new String[] {
            "State", "Opposition", "Reform", "Security", "Civil liberties"
    };

    private FrameLayout root;
    private View splashView;
    private View errorView;
    private View contentView;
    private LinearLayout reportContainer;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String[] archiveDates = new String[0];
    private String selectedDate = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureFullscreenWindow();
        root = new FrameLayout(this);
        setContentView(root);
        enterImmersiveMode();
        showSplash();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                showArchiveBrowser();
            }
        }, 1400);
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    private void configureFullscreenWindow() {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window window = getWindow();
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void showSplash() {
        LinearLayout splash = new LinearLayout(this);
        splash.setOrientation(LinearLayout.VERTICAL);
        splash.setGravity(Gravity.CENTER);
        splash.setPadding(dp(24), dp(24), dp(24), dp(24));
        splash.setBackgroundColor(Color.rgb(4, 9, 12));

        TextView title = new TextView(this);
        title.setText("Print Media Review");
        title.setTextColor(Color.rgb(236, 248, 245));
        title.setTextSize(30);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setIncludeFontPadding(false);

        GlobeView globe = new GlobeView(this);
        LinearLayout.LayoutParams globeParams = new LinearLayout.LayoutParams(dp(210), dp(210));
        globeParams.topMargin = dp(24);

        splash.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        splash.addView(globe, globeParams);

        splashView = splash;
        root.addView(splashView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    private void showArchiveBrowser() {
        if (contentView != null) {
            return;
        }

        archiveDates = loadArchiveDates();
        removeSplash();
        hideError();

        if (archiveDates.length == 0) {
            showConnectionError(
                    "No Reports Found",
                    "The Android app is now native. Place archived report JSON files in the app assets under assets/archive/. No web server is required.\n\n"
                            + getArchiveDebugInfo()
            );
            return;
        }

        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.rgb(4, 9, 12));
        container.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView title = new TextView(this);
        title.setText("Print Media Review");
        title.setTextColor(Color.rgb(236, 248, 245));
        title.setTextSize(28);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setIncludeFontPadding(false);

        TextView subtitle = new TextView(this);
        subtitle.setText("Native archive viewer for Pakistan print media reports.");
        subtitle.setTextColor(Color.rgb(147, 168, 170));
        subtitle.setTextSize(15);
        subtitle.setLineSpacing(dp(4), 1f);
        subtitle.setPadding(0, dp(8), 0, dp(16));

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        actionRow.setGravity(Gravity.END);
        actionRow.setPadding(0, 0, 0, dp(16));

        Button refreshButton = new Button(this);
        refreshButton.setText("Refresh");
        refreshButton.setTextColor(Color.rgb(236, 248, 245));
        refreshButton.setAllCaps(false);
        refreshButton.setBackgroundColor(Color.rgb(24, 55, 70));
        refreshButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (selectedDate != null) {
                    loadReport(selectedDate);
                }
            }
        });

        actionRow.addView(refreshButton, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout datesLayout = new LinearLayout(this);
        datesLayout.setOrientation(LinearLayout.VERTICAL);
        datesLayout.setPadding(0, dp(10), 0, dp(24));

        for (final String date : archiveDates) {
            Button dateButton = new Button(this);
            dateButton.setText(date);
            dateButton.setTextColor(Color.rgb(4, 9, 12));
            dateButton.setAllCaps(false);
            dateButton.setBackgroundColor(Color.rgb(236, 248, 245));
            dateButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    selectedDate = date;
                    loadReport(date);
                }
            });

            LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            buttonParams.bottomMargin = dp(8);
            datesLayout.addView(dateButton, buttonParams);
        }

        reportContainer = new LinearLayout(this);
        reportContainer.setOrientation(LinearLayout.VERTICAL);
        reportContainer.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        container.addView(title);
        container.addView(subtitle);
        container.addView(actionRow);
        container.addView(datesLayout);
        container.addView(reportContainer);

        scrollView.addView(container, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        contentView = scrollView;
        root.addView(contentView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        if (archiveDates.length > 0) {
            selectedDate = archiveDates[0];
            loadReport(selectedDate);
        }
    }

    private String[] loadArchiveDates() {
        try {
            String[] dates = getAssets().list("archive");
            if (dates == null) {
                return new String[0];
            }
            Arrays.sort(dates, Collections.reverseOrder());
            return dates;
        } catch (IOException error) {
            return new String[0];
        }
    }

    private String getArchiveDebugInfo() {
        try {
            String[] archiveEntries = getAssets().list("archive");
            if (archiveEntries == null) {
                return "Asset scan: archive directory not found in assets.";
            }
            if (archiveEntries.length == 0) {
                return "Asset scan: archive directory exists, but contains no entries.";
            }
            StringBuilder debug = new StringBuilder("Asset scan: archive entries found: ");
            for (String entry : archiveEntries) {
                debug.append(entry).append(", ");
            }
            debug.setLength(debug.length() - 2);
            return debug.toString();
        } catch (IOException error) {
            return "Asset scan error: " + error.getMessage();
        }
    }

    private void loadReport(String date) {
        if (reportContainer == null) {
            return;
        }

        reportContainer.removeAllViews();
        TextView loading = new TextView(this);
        loading.setText("Loading report for " + date + "...");
        loading.setTextColor(Color.rgb(236, 248, 245));
        loading.setTextSize(16);
        loading.setPadding(0, 0, 0, dp(12));
        reportContainer.addView(loading);

        try {
            JSONObject report = readReport(date);
            displayReport(report);
        } catch (Exception error) {
            showConnectionError("Unable to load report", error.getMessage());
        }
    }

    private JSONObject readReport(String date) throws IOException, JSONException {
        String assetPath = "archive/" + date + "/report.json";
        AssetManager assets = getAssets();
        try (InputStream input = assets.open(assetPath)) {
            String json = readStream(input);
            return new JSONObject(json);
        }
    }

    private String readStream(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int length;
        while ((length = input.read(buffer)) != -1) {
            output.write(buffer, 0, length);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private void displayReport(JSONObject report) throws JSONException {
        reportContainer.removeAllViews();

        TextView reportTitle = new TextView(this);
        reportTitle.setText(report.getString("date"));
        reportTitle.setTextColor(Color.rgb(236, 248, 245));
        reportTitle.setTextSize(22);
        reportTitle.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        reportTitle.setPadding(0, 0, 0, dp(6));

        TextView meta = new TextView(this);
        meta.setText(report.getString("readTime"));
        meta.setTextColor(Color.rgb(147, 168, 170));
        meta.setTextSize(14);
        meta.setLineSpacing(dp(4), 1f);
        meta.setPadding(0, 0, 0, dp(4));

        TextView fetchInfo = new TextView(this);
        fetchInfo.setText(report.getString("fetchWindow") + "\n" + report.getString("fetchedAt"));
        fetchInfo.setTextColor(Color.rgb(147, 168, 170));
        fetchInfo.setTextSize(14);
        fetchInfo.setLineSpacing(dp(4), 1f);
        fetchInfo.setPadding(0, 0, 0, dp(14));

        reportContainer.addView(reportTitle);
        reportContainer.addView(meta);
        reportContainer.addView(fetchInfo);

        JSONArray sections = report.getJSONArray("sections");
        boolean sectionAdded = false;
        for (int index = 0; index < sections.length(); index++) {
            JSONObject section = sections.getJSONObject(index);
            if ("blocked".equals(section.optString("status", ""))) {
                continue;
            }
            reportContainer.addView(createSectionCard(section));
            sectionAdded = true;
        }

        if (!sectionAdded) {
            TextView empty = new TextView(this);
            empty.setText("No readable sections available for this report.");
            empty.setTextColor(Color.rgb(190, 220, 230));
            empty.setTextSize(14);
            reportContainer.addView(empty);
        }
    }

    private View createSectionCard(JSONObject section) throws JSONException {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundColor(Color.argb(22, 236, 248, 245));
        card.setPadding(dp(14), dp(14), dp(14), dp(14));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardParams.bottomMargin = dp(12);
        card.setLayoutParams(cardParams);

        TextView source = new TextView(this);
        source.setText(section.getString("source"));
        source.setTextColor(Color.rgb(236, 248, 245));
        source.setTextSize(18);
        source.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        source.setPadding(0, 0, 0, dp(4));

        String status = section.optString("status", "unknown");
        TextView statusText = new TextView(this);
        statusText.setText("Status: " + status);
        statusText.setTextColor(Color.rgb(147, 168, 170));
        statusText.setTextSize(13);
        statusText.setPadding(0, 0, 0, dp(8));

        card.addView(source);
        card.addView(statusText);

        if (section.has("scores")) {
            JSONObject scores = section.getJSONObject("scores");
            StringBuilder scoring = new StringBuilder("Comparative score line: ");
            for (int i = 0; i < SCORE_NAMES.length; i++) {
                String name = SCORE_NAMES[i];
                scoring.append(name).append(": ").append(formatScore(scores.optDouble(name, 0)));
                if (i + 1 < SCORE_NAMES.length) {
                    scoring.append(" | ");
                }
            }
            TextView scoresText = new TextView(this);
            scoresText.setText(scoring.toString());
            scoresText.setTextColor(Color.rgb(190, 220, 230));
            scoresText.setTextSize(13);
            scoresText.setPadding(0, 0, 0, dp(10));
            card.addView(scoresText);
        }

        if (section.has("error")) {
            TextView errorText = new TextView(this);
            errorText.setText(section.getString("error"));
            errorText.setTextColor(Color.rgb(255, 182, 193));
            errorText.setTextSize(14);
            errorText.setPadding(0, 0, 0, dp(10));
            card.addView(errorText);
        }

        JSONArray items = section.optJSONArray("items");
        if (items == null || items.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("No matching articles available.");
            empty.setTextColor(Color.rgb(190, 220, 230));
            empty.setTextSize(14);
            card.addView(empty);
        } else {
            for (int itemIndex = 0; itemIndex < items.length(); itemIndex++) {
                JSONObject item = items.getJSONObject(itemIndex);
                TextView itemView = new TextView(this);
                String title = item.optString("title", "Untitled");
                String author = item.optString("author", "Unknown");
                String theme = item.optString("theme", "");
                String tone = item.optString("tone", "");
                String summary = item.optString("summary", "");
                String text = "- " + title
                        + "\n" + author + (theme.isEmpty() ? "" : " · " + theme)
                        + (tone.isEmpty() ? "" : " (" + tone + ")")
                        + "\n" + summary;
                itemView.setText(text);
                itemView.setTextColor(Color.rgb(225, 239, 242));
                itemView.setTextSize(14);
                itemView.setLineSpacing(dp(4), 1f);
                itemView.setPadding(0, 0, 0, dp(10));
                String url = item.optString("url", "");
                if (!url.isEmpty()) {
                    itemView.setPaintFlags(itemView.getPaintFlags() | Paint.UNDERLINE_TEXT_FLAG);
                    itemView.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View view) {
                            openLink(url);
                        }
                    });
                }
                card.addView(itemView);
            }
        }

        return card;
    }

    private void showConnectionError(String titleText, String bodyText) {
        removeSplash();
        if (errorView != null) {
            return;
        }

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(Color.rgb(4, 9, 12));

        TextView title = new TextView(this);
        title.setText(titleText);
        title.setTextColor(Color.rgb(236, 248, 245));
        title.setTextSize(26);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setIncludeFontPadding(false);

        TextView message = new TextView(this);
        message.setText(bodyText);
        message.setTextColor(Color.rgb(147, 168, 170));
        message.setTextSize(15);
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(dp(3), 1f);

        Button retry = new Button(this);
        retry.setText("Reload");
        retry.setTextColor(Color.rgb(2, 21, 18));
        retry.setAllCaps(false);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                hideError();
                showSplash();
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        showArchiveBrowser();
                    }
                }, 800);
            }
        });

        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        messageParams.topMargin = dp(18);

        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(dp(150), dp(48));
        buttonParams.topMargin = dp(24);

        panel.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        panel.addView(message, messageParams);
        panel.addView(retry, buttonParams);

        errorView = panel;
        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        enterImmersiveMode();
    }

    private void hideError() {
        if (errorView != null) {
            root.removeView(errorView);
            errorView = null;
        }
    }

    private void openLink(String url) {
        if (url == null || url.isEmpty()) {
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception ignored) {
            // Ignore invalid link launches.
        }
    }

    private String formatScore(double value) {
        return String.format("%.1f", value);
    }

    private void removeSplash() {
        if (splashView != null) {
            root.removeView(splashView);
            splashView = null;
        }
        enterImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static class GlobeView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float rotation = 0f;

        GlobeView(Activity context) {
            super(context);
            paint.setStrokeCap(Paint.Cap.ROUND);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int width = getWidth();
            int height = getHeight();
            float cx = width / 2f;
            float cy = height / 2f;
            float radius = Math.min(width, height) * 0.36f;

            canvas.drawColor(Color.TRANSPARENT);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.2f);
            paint.setColor(Color.argb(46, 61, 242, 212));
            for (int i = -3; i <= 3; i++) {
                float offset = i * radius / 3f;
                canvas.drawLine(cx - radius * 1.35f, cy + offset, cx + radius * 1.35f, cy + offset, paint);
                canvas.drawLine(cx + offset, cy - radius * 1.35f, cx + offset, cy + radius * 1.35f, paint);
            }

            paint.setStrokeWidth(2.2f);
            paint.setColor(Color.argb(230, 61, 242, 212));
            canvas.drawCircle(cx, cy, radius, paint);

            paint.setStrokeWidth(1.4f);
            paint.setColor(Color.argb(140, 94, 183, 255));
            for (int i = -2; i <= 2; i++) {
                float yRadius = radius * (1f - Math.abs(i) * 0.16f);
                canvas.drawOval(cx - radius, cy - yRadius * 0.42f + i * radius * 0.22f,
                        cx + radius, cy + yRadius * 0.42f + i * radius * 0.22f, paint);
            }

            paint.setColor(Color.argb(155, 61, 242, 212));
            for (int i = -2; i <= 2; i++) {
                float xRadius = radius * (0.22f + Math.abs(i) * 0.17f);
                canvas.drawOval(cx - xRadius, cy - radius, cx + xRadius, cy + radius, paint);
            }

            canvas.save();
            canvas.rotate(rotation, cx, cy);
            paint.setStrokeWidth(1.5f);
            paint.setColor(Color.argb(180, 247, 200, 87));
            canvas.drawArc(cx - radius * 1.17f, cy - radius * 0.42f,
                    cx + radius * 1.17f, cy + radius * 0.42f, 20, 210, false, paint);
            canvas.restore();

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(57, 214, 111));
            canvas.drawCircle(cx + radius * 0.26f, cy - radius * 0.12f, radius * 0.055f, paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.4f);
            paint.setColor(Color.argb(190, 57, 214, 111));
            canvas.drawCircle(cx + radius * 0.26f, cy - radius * 0.12f,
                    radius * (0.13f + 0.03f * (float) Math.sin(rotation * 0.05f)), paint);

            rotation += 2.5f;
            postInvalidateOnAnimation();
        }
    }
}
