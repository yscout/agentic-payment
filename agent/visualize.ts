import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { type CollectedData } from "./report.js";

export function generateHtmlReport(
  data: CollectedData,
  totalSpent: number,
  walletAddress: string,
  queriesCompleted: number,
  remainingBalance: string,
): string {
  const sentimentEntries = [...data.sentiment.entries()].sort(
    (a, b) => b[1].score - a[1].score,
  );

  const tickers = sentimentEntries.map(([t]) => `"${t}"`).join(", ");
  const scores = sentimentEntries.map(([, s]) => s.score.toFixed(3)).join(", ");
  const barColors = sentimentEntries
    .map(([, s]) =>
      s.score > 0.3
        ? '"#22c55e"'
        : s.score < -0.3
          ? '"#ef4444"'
          : '"#eab308"',
    )
    .join(", ");

  const recommendations = sentimentEntries.map(([ticker, s]) => {
    if (s.score > 0.3) return { ticker, rec: "BUY", color: "#22c55e" };
    if (s.score < -0.3) return { ticker, rec: "SELL", color: "#ef4444" };
    return { ticker, rec: "HOLD", color: "#eab308" };
  });

  const buyCount = recommendations.filter((r) => r.rec === "BUY").length;
  const holdCount = recommendations.filter((r) => r.rec === "HOLD").length;
  const sellCount = recommendations.filter((r) => r.rec === "SELL").length;

  const financialRows = [...data.financial.entries()]
    .map(
      ([key, f]) => `
      <tr>
        <td>${key}</td>
        <td><span class="impact impact-${f.impact}">${f.impact.toUpperCase()}</span></td>
        <td>${f.headline}</td>
        <td>${f.summary}</td>
      </tr>`,
    )
    .join("");

  const weatherCards = [...data.weather.entries()]
    .map(
      ([city, w]) => `
      <div class="weather-card">
        <div class="weather-city">${city}</div>
        <div class="weather-temp">${w.temperature_c}&deg;C</div>
        <div class="weather-conditions">${w.conditions}</div>
        <div class="weather-detail">Humidity ${w.humidity_pct}% &middot; Wind ${w.wind_kph} kph</div>
      </div>`,
    )
    .join("");

  const recCards = recommendations
    .map(
      (r) => `
      <div class="rec-card" style="border-left: 4px solid ${r.color}">
        <span class="rec-ticker">${r.ticker}</span>
        <span class="rec-action" style="color: ${r.color}">${r.rec}</span>
      </div>`,
    )
    .join("");

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Research Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0; padding: 2rem;
  }
  .container { max-width: 1100px; margin: 0 auto; }
  header {
    text-align: center; margin-bottom: 2.5rem;
    border-bottom: 1px solid #334155; padding-bottom: 1.5rem;
  }
  header h1 { font-size: 1.75rem; color: #f8fafc; margin-bottom: 0.25rem; }
  header p { color: #94a3b8; font-size: 0.9rem; }
  .meta-bar {
    display: flex; gap: 1.5rem; justify-content: center;
    flex-wrap: wrap; margin-top: 1rem;
  }
  .meta-item {
    background: #1e293b; padding: 0.5rem 1rem; border-radius: 8px;
    font-size: 0.85rem;
  }
  .meta-item strong { color: #38bdf8; }
  .section { margin-bottom: 2.5rem; }
  .section h2 {
    font-size: 1.15rem; color: #f8fafc; margin-bottom: 1rem;
    padding-bottom: 0.5rem; border-bottom: 1px solid #1e293b;
  }
  .charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }
  .chart-box {
    background: #1e293b; border-radius: 12px; padding: 1.5rem;
  }
  canvas { width: 100% !important; }
  .rec-grid { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .rec-card {
    background: #1e293b; padding: 0.75rem 1rem; border-radius: 8px;
    display: flex; align-items: center; gap: 0.75rem; min-width: 140px;
  }
  .rec-ticker { font-weight: 700; font-size: 1.1rem; }
  .rec-action { font-weight: 700; font-size: 0.95rem; }
  table {
    width: 100%; border-collapse: collapse;
    background: #1e293b; border-radius: 12px; overflow: hidden;
  }
  th, td { padding: 0.75rem 1rem; text-align: left; }
  th { background: #334155; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { border-top: 1px solid #334155; font-size: 0.9rem; }
  .impact {
    padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
  }
  .impact-positive { background: #166534; color: #86efac; }
  .impact-negative { background: #7f1d1d; color: #fca5a5; }
  .impact-neutral { background: #713f12; color: #fde047; }
  .weather-row { display: flex; gap: 1rem; flex-wrap: wrap; }
  .weather-card {
    background: #1e293b; border-radius: 12px; padding: 1.25rem;
    min-width: 180px; flex: 1; text-align: center;
  }
  .weather-city { font-weight: 700; font-size: 1rem; margin-bottom: 0.25rem; }
  .weather-temp { font-size: 2rem; font-weight: 700; color: #38bdf8; }
  .weather-conditions { color: #94a3b8; margin: 0.25rem 0; text-transform: capitalize; }
  .weather-detail { font-size: 0.8rem; color: #64748b; }
  .footer {
    text-align: center; margin-top: 2rem; padding-top: 1.5rem;
    border-top: 1px solid #334155; color: #64748b; font-size: 0.8rem;
  }
  .footer a { color: #38bdf8; text-decoration: none; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Investment Research Report</h1>
    <p>Generated autonomously by AI agent &middot; Data purchased via ETH payments on Base Sepolia</p>
    <div class="meta-bar">
      <div class="meta-item">Wallet: <strong>${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</strong></div>
      <div class="meta-item">Queries: <strong>${queriesCompleted}</strong></div>
      <div class="meta-item">Cost: <strong>${totalSpent.toFixed(8)} ETH</strong></div>
      <div class="meta-item">Remaining: <strong>${remainingBalance} ETH</strong></div>
      <div class="meta-item">Time: <strong>${timestamp}</strong></div>
    </div>
  </header>

  <div class="section">
    <h2>Market Sentiment</h2>
    <div class="charts-row">
      <div class="chart-box"><canvas id="sentimentChart"></canvas></div>
      <div class="chart-box"><canvas id="recChart"></canvas></div>
    </div>
  </div>

  <div class="section">
    <h2>Recommendations</h2>
    <div class="rec-grid">${recCards}</div>
  </div>

  <div class="section">
    <h2>Financial Highlights</h2>
    <table>
      <thead><tr><th>Topic</th><th>Impact</th><th>Headline</th><th>Summary</th></tr></thead>
      <tbody>${financialRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Trading Hub Conditions</h2>
    <div class="weather-row">${weatherCards}</div>
  </div>

  <div class="footer">
    All data purchased autonomously from data provider agent using
    ETH payments on Base Sepolia.
    No human approved any payment.
  </div>
</div>

<script>
new Chart(document.getElementById('sentimentChart'), {
  type: 'bar',
  data: {
    labels: [${tickers}],
    datasets: [{
      label: 'Sentiment Score',
      data: [${scores}],
      backgroundColor: [${barColors}],
      borderRadius: 6,
      borderSkipped: false,
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        min: -1, max: 1,
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'Score (-1 bearish to +1 bullish)', color: '#94a3b8' }
      },
      x: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { weight: 'bold' } } }
    },
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Sentiment Score by Ticker', color: '#f8fafc', font: { size: 14 } }
    }
  }
});

new Chart(document.getElementById('recChart'), {
  type: 'doughnut',
  data: {
    labels: ['BUY', 'HOLD', 'SELL'],
    datasets: [{
      data: [${buyCount}, ${holdCount}, ${sellCount}],
      backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
      borderWidth: 0,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: { display: true, text: 'Recommendation Split', color: '#f8fafc', font: { size: 14 } },
      legend: { labels: { color: '#e2e8f0' } }
    }
  }
});
<\/script>
</body>
</html>`;
}

export function saveAndOpenReport(
  data: CollectedData,
  totalSpent: number,
  walletAddress: string,
  queriesCompleted: number,
  remainingBalance: string,
): string {
  const html = generateHtmlReport(
    data,
    totalSpent,
    walletAddress,
    queriesCompleted,
    remainingBalance,
  );

  mkdirSync("output", { recursive: true });

  const filename = `report-${Date.now()}.html`;
  const filepath = `output/${filename}`;
  writeFileSync(filepath, html, "utf-8");
  console.log(`\n  Report saved to: ${filepath}`);

  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open ${filepath}`);
    else if (platform === "linux") execSync(`xdg-open ${filepath}`);
    else if (platform === "win32") execSync(`start ${filepath}`);
    console.log("  Report opened in browser.");
  } catch {
    console.log("  Open the file manually in your browser.");
  }

  return filepath;
}
