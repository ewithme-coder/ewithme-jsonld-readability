/**
 * extension.js
 * ------------
 * eWith.me JSON-LD Schema & Readability Inspector for Visual Studio Code.
 * Provides real-time Schema.org JSON-LD diagnostics, Wikidata entity grounding checks,
 * Flesch-Kincaid & Sentence Burstiness readability scoring, and interactive SEO audit reports.
 *
 * 100% Local In-Editor Execution • Zero Telemetry • https://ewith.me
 */

let vscode = null;
try {
  vscode = require('vscode');
} catch (_) {
  // Allows pure unit testing of analysis functions outside VS Code host
}

const REQUIRED_SCHEMA_FIELDS = {
  Article: ['headline', 'author', 'datePublished'],
  NewsArticle: ['headline', 'author', 'datePublished'],
  TechArticle: ['headline', 'author', 'datePublished'],
  BlogPosting: ['headline', 'author', 'datePublished'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  JobPosting: ['title', 'description', 'datePosted', 'hiringOrganization'],
  Course: ['name', 'description', 'provider'],
  CollegeOrUniversity: ['name'],
  EducationalOrganization: ['name'],
  WebApplication: ['name', 'applicationCategory'],
  SoftwareApplication: ['name', 'applicationCategory'],
  Organization: ['name', 'url'],
  WebSite: ['name', 'url']
};

const AI_CLICHE_PATTERNS = [
  /\bdelve into\b/i,
  /\btestament to\b/i,
  /\btapestry of\b/i,
  /\bin today's fast-paced world\b/i,
  /\bit is important to note that\b/i,
  /\bmoreover, it is crucial\b/i,
  /\bunlock the full potential\b/i,
  /\bpave the way for\b/i
];

/**
 * Counts approximate English syllables in a word for Flesch-Kincaid calculation.
 */
function countSyllables(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

/**
 * Strips HTML, JSX, JSON-LD script blocks, and Markdown syntax to extract readable prose.
 */
function stripMarkupToProse(rawText, languageId = '') {
  if (!rawText) return '';
  if (languageId === 'json' || languageId === 'jsonc') return '';

  return String(rawText)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Flesch Reading Ease, Flesch-Kincaid Grade, Sentence Length Burstiness (sigma),
 * reading/speaking time, and AI-cliché detections.
 */
function computeReadabilityMetrics(rawText, languageId = '') {
  const prose = stripMarkupToProse(rawText, languageId);
  const words = prose.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      fleschEase: 0,
      fkGrade: 0,
      burstinessSigma: 0,
      readTimeMin: 0,
      speakTimeMin: 0,
      clichesFound: []
    };
  }

  const rawSentences = prose
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
  const sentenceCount = Math.max(1, rawSentences.length);

  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countSyllables(w);
  }

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = totalSyllables / wordCount;

  const fleschRaw = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
  const fleschEase = Number(Math.max(0, Math.min(100, fleschRaw)).toFixed(1));

  const fkRaw = (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59;
  const fkGrade = Number(Math.max(1, Math.min(22, fkRaw)).toFixed(1));

  // Sentence Length Burstiness (Standard Deviation of sentence word counts)
  const sentLengths = rawSentences.map(s => (s.match(/[A-Za-z0-9]+/g) || []).length);
  const meanLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
  const variance = sentLengths.reduce((acc, len) => acc + Math.pow(len - meanLen, 2), 0) / sentLengths.length;
  const burstinessSigma = Number(Math.sqrt(variance).toFixed(1));

  const clichesFound = [];
  for (const pat of AI_CLICHE_PATTERNS) {
    const m = prose.match(pat);
    if (m) clichesFound.push(m[0]);
  }

  return {
    wordCount,
    sentenceCount,
    fleschEase,
    fkGrade,
    burstinessSigma,
    readTimeMin: Math.max(1, Math.ceil(wordCount / 225)),
    speakTimeMin: Math.max(1, Math.ceil(wordCount / 140)),
    clichesFound
  };
}

/**
 * Extracts and validates all JSON-LD blocks from HTML/Markdown/JSX or standalone JSON-LD files.
 */
function analyzeJsonLdBlocks(rawText, fileName = '', languageId = '') {
  const blocks = [];
  const text = String(rawText || '');
  const isPureJson = languageId === 'json' || fileName.endsWith('.json') || fileName.endsWith('.jsonld');

  if (isPureJson && (text.includes('"@context"') || text.includes('"@type"'))) {
    blocks.push({ jsonText: text, startOffset: 0, endOffset: text.length });
  } else {
    const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(text)) !== null) {
      const innerStart = match.index + match[0].indexOf(match[1]);
      blocks.push({
        jsonText: match[1],
        startOffset: innerStart,
        endOffset: innerStart + match[1].length
      });
    }
  }

  const schemas = [];
  const issues = [];

  blocks.forEach((b, idx) => {
    try {
      const parsed = JSON.parse(b.jsonText.trim());
      const nodes = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : [parsed];

      const rootContext = parsed['@context'];
      if (!rootContext || !String(rootContext).includes('schema.org')) {
        issues.push({
          severity: 'warning',
          message: `JSON-LD Block #${idx + 1}: Missing or non-standard "@context" (expected "https://schema.org").`,
          startOffset: b.startOffset,
          endOffset: b.endOffset
        });
      }

      nodes.forEach((node) => {
        if (!node || typeof node !== 'object') return;
        const rawType = node['@type'];
        const typeList = Array.isArray(rawType) ? rawType : (rawType ? [rawType] : []);
        const primaryType = typeList[0] || 'Unknown';

        if (!rawType) {
          issues.push({
            severity: 'error',
            message: `JSON-LD Block #${idx + 1}: Schema object is missing required "@type" property.`,
            startOffset: b.startOffset,
            endOffset: b.endOffset
          });
        }

        const required = REQUIRED_SCHEMA_FIELDS[primaryType] || [];
        const missing = required.filter(req => node[req] === undefined || node[req] === null || node[req] === '');
        if (missing.length > 0) {
          issues.push({
            severity: 'warning',
            message: `Schema.org ${primaryType}: Missing recommended Rich Result field(s): ${missing.join(', ')}`,
            startOffset: b.startOffset,
            endOffset: b.endOffset
          });
        }

        // Check Wikidata entity grounding (sameAs / about / mentions)
        const nodeStr = JSON.stringify(node);
        const hasWikidata = /wikidata\.org\/wiki\/Q\d+/i.test(nodeStr);

        schemas.push({
          type: primaryType,
          name: node.headline || node.title || node.name || primaryType,
          missingFields: missing,
          hasWikidata
        });
      });
    } catch (parseErr) {
      issues.push({
        severity: 'error',
        message: `JSON-LD Syntax Error in Block #${idx + 1}: ${parseErr.message}`,
        startOffset: b.startOffset,
        endOffset: b.endOffset
      });
    }
  });

  return { blockCount: blocks.length, schemas, issues };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAuditWebviewHtml(fileName, schemaReport, readability) {
  const schemaRows = schemaReport.schemas.length > 0
    ? schemaReport.schemas.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.type)}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.missingFields.length === 0
          ? '<span class="badge ok">✓ Complete</span>'
          : `<span class="badge warn">Missing: ${escapeHtml(s.missingFields.join(', '))}</span>`}</td>
        <td>${s.hasWikidata
          ? '<span class="badge ok">✓ Wikidata Grounded</span>'
          : '<span class="badge neutral">Optional</span>'}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No JSON-LD blocks detected in this file. Use <code>eWith.me: Insert JSON-LD Schema Template</code> to add one.</td></tr>`;

  const issueItems = schemaReport.issues.length > 0
    ? schemaReport.issues.map(iss => `
      <li class="issue-${iss.severity}">
        <strong>[${iss.severity.toUpperCase()}]</strong> ${escapeHtml(iss.message)}
      </li>
    `).join('')
    : `<li class="issue-ok">✓ Zero JSON-LD syntax or required property issues detected.</li>`;

  const burstStatus = readability.burstinessSigma >= 5.5
    ? '✓ High Natural Human Burstiness'
    : readability.wordCount > 50
    ? '⚠️ Low Sentence Variation (Consider mixing short & long sentences)'
    : 'N/A (Short snippet)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif;
    padding: 24px 28px;
    background: #0f172a;
    color: #f1f5f9;
    line-height: 1.6;
  }
  .header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 22px;
  }
  .title { font-size: 20px; font-weight: 800; color: #ffffff; }
  .subtitle { font-size: 12.5px; color: #94a3b8; margin-top: 2px; }
  .grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;
  }
  .stat-card {
    background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px 16px;
  }
  .stat-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-val { font-size: 24px; font-weight: 800; color: #a5b4fc; margin-top: 4px; }
  .stat-note { font-size: 11.5px; color: #cbd5e1; margin-top: 4px; }
  h2 { font-size: 15px; font-weight: 700; margin: 20px 0 10px; color: #e2e8f0; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
  th, td { text-align: left; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #334155; }
  th { background: #090d16; color: #94a3b8; font-weight: 700; font-size: 11.5px; text-transform: uppercase; }
  .badge { padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge.ok { background: #064e3b; color: #6ee7b7; }
  .badge.warn { background: #78350f; color: #fcd34d; }
  .badge.neutral { background: #334155; color: #cbd5e1; }
  ul.issues { list-style: none; padding: 0; margin: 0 0 22px; }
  ul.issues li { padding: 9px 14px; border-radius: 8px; margin-bottom: 6px; font-size: 13px; background: #1e293b; border: 1px solid #334155; }
  ul.issues li.issue-error { border-left: 4px solid #ef4444; }
  ul.issues li.issue-warning { border-left: 4px solid #f59e0b; }
  ul.issues li.issue-ok { border-left: 4px solid #10b981; color: #6ee7b7; }
  .tools-bar {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #334155;
  }
  a.tool-btn {
    background: #312e81; color: #e0e7ff; text-decoration: none; padding: 7px 13px;
    border-radius: 7px; font-size: 12px; font-weight: 600; border: 1px solid #4f46e5;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">✨ eWith.me JSON-LD Schema &amp; Readability Report</div>
      <div class="subtitle">Audited File: ${escapeHtml(fileName)} • 100% Local In-Editor Analysis</div>
    </div>
    <a class="tool-btn" href="https://ewith.me">Open eWith.me Studio ↗</a>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="stat-label">Flesch Reading Ease</div>
      <div class="stat-val">${readability.fleschEase}</div>
      <div class="stat-note">Grade Level: ${readability.fkGrade}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sentence Burstiness (σ)</div>
      <div class="stat-val">${readability.burstinessSigma}</div>
      <div class="stat-note">${escapeHtml(burstStatus)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Word &amp; Sentence Count</div>
      <div class="stat-val">${readability.wordCount}w</div>
      <div class="stat-note">${readability.sentenceCount} sentences (~${readability.readTimeMin}m read)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">JSON-LD Entities</div>
      <div class="stat-val">${schemaReport.schemas.length}</div>
      <div class="stat-note">${schemaReport.issues.length} diagnostic notice(s)</div>
    </div>
  </div>

  <h2>1. Extracted Schema.org JSON-LD Entities</h2>
  <table>
    <thead>
      <tr>
        <th>@type</th>
        <th>Headline / Name</th>
        <th>Rich Result Property Check</th>
        <th>Entity Grounding</th>
      </tr>
    </thead>
    <tbody>
      ${schemaRows}
    </tbody>
  </table>

  <h2>2. JSON-LD &amp; Content Guardian Diagnostics</h2>
  <ul class="issues">
    ${issueItems}
    ${readability.clichesFound.length > 0
      ? `<li class="issue-warning"><strong>[STYLE]</strong> Detected overused AI cliché phrase(s): <em>${escapeHtml(readability.clichesFound.join(', '))}</em></li>`
      : ''}
  </ul>

  <h2>3. eWith.me Online AI &amp; SEO Utilities</h2>
  <div class="tools-bar">
    <a class="tool-btn" href="https://ewith.me/ai-humanizer">AI Humanizer</a>
    <a class="tool-btn" href="https://ewith.me/paraphrasing-tool">Paraphrasing Tool</a>
    <a class="tool-btn" href="https://ewith.me/grammar-checker">Grammar Checker</a>
    <a class="tool-btn" href="https://ewith.me/summarizer">Summarizer</a>
    <a class="tool-btn" href="https://ewith.me/citation-generator">Citation Generator</a>
    <a class="tool-btn" href="https://ewith.me/docs">Architecture Docs</a>
    <a class="tool-btn" href="https://ewith.me/privacy">Privacy Policy</a>
  </div>
</body>
</html>`;
}

function activate(context) {
  if (!vscode) return;

  const diagnostics = vscode.languages.createDiagnosticCollection('ewithme-jsonld');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'ewithme.auditDocument';
  statusBar.tooltip = 'Click to open eWith.me JSON-LD Schema & Readability Audit Report';
  context.subscriptions.push(diagnostics, statusBar);

  function refreshDocumentDiagnostics(doc) {
    if (!doc || doc.isClosed) return;
    const supported = ['html', 'markdown', 'json', 'jsonc', 'javascriptreact', 'typescriptreact', 'vue', 'astro', 'ejs', 'plaintext'];
    if (!supported.includes(doc.languageId) && !/\.(html?|jsonld|md|mdx|jsx|tsx)$/i.test(doc.fileName)) {
      statusBar.hide();
      return;
    }

    const text = doc.getText();
    const schemaReport = analyzeJsonLdBlocks(text, doc.fileName, doc.languageId);
    const readability = computeReadabilityMetrics(text, doc.languageId);

    const diagList = schemaReport.issues.map(iss => {
      const startPos = doc.positionAt(iss.startOffset || 0);
      const endPos = doc.positionAt(iss.endOffset || Math.min(text.length, (iss.startOffset || 0) + 20));
      const sev = iss.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
      const d = new vscode.Diagnostic(new vscode.Range(startPos, endPos), iss.message, sev);
      d.source = 'eWith.me JSON-LD';
      return d;
    });
    diagnostics.set(doc.uri, diagList);

    const schemaLabel = schemaReport.schemas.length > 0
      ? ` • ${schemaReport.schemas.length} Schema(s)`
      : '';
    statusBar.text = `$(sparkle) eWith: Flesch ${readability.fleschEase} (G${readability.fkGrade})${schemaLabel}`;
    statusBar.show();
  }

  if (vscode.window.activeTextEditor) {
    refreshDocumentDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document) refreshDocumentDiagnostics(editor.document);
    }),
    vscode.workspace.onDidChangeTextDocument(evt => {
      if (evt && evt.document) refreshDocumentDiagnostics(evt.document);
    })
  );

  // Command 1: Open Interactive Audit Webview
  const auditCmd = vscode.commands.registerCommand('ewithme.auditDocument', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open an HTML, Markdown, JSX/TSX, or JSON-LD file to run the eWith.me Audit.');
      return;
    }
    const doc = editor.document;
    const selection = editor.selection;
    const targetText = (!selection.isEmpty) ? doc.getText(selection) : doc.getText();

    const schemaReport = analyzeJsonLdBlocks(doc.getText(), doc.fileName, doc.languageId);
    const readability = computeReadabilityMetrics(targetText, doc.languageId);

    const panel = vscode.window.createWebviewPanel(
      'ewithmeAuditReport',
      'eWith.me Schema & Readability Audit',
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );
    panel.webview.html = buildAuditWebviewHtml(doc.fileName.split(/[\\/]/).pop(), schemaReport, readability);
  });

  // Command 2: Insert JSON-LD Schema Template
  const insertCmd = vscode.commands.registerCommand('ewithme.insertSchemaTemplate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const pick = await vscode.window.showQuickPick([
      {
        label: 'Article + Wikidata Entity Grounding',
        description: 'Schema.org Article with author, publisher, and Wikidata about[] array',
        key: 'article'
      },
      {
        label: 'FAQPage Schema',
        description: 'Schema.org FAQPage with Question & acceptedAnswer mainEntity',
        key: 'faq'
      },
      {
        label: 'BreadcrumbList Schema',
        description: 'Schema.org BreadcrumbList hierarchy',
        key: 'breadcrumb'
      },
      {
        label: 'JobPosting Schema',
        description: 'Schema.org JobPosting for Google Jobs & ATS feeds',
        key: 'job'
      }
    ], { placeHolder: 'Select a Schema.org JSON-LD template to insert' });

    if (!pick) return;

    const templates = {
      article: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": "Article Headline",\n  "description": "Concise summary of the article",\n  "datePublished": "${new Date().toISOString().slice(0, 10)}",\n  "author": {\n    "@type": "Person",\n    "name": "Author Name",\n    "url": "https://ewith.me/"\n  },\n  "publisher": {\n    "@type": "Organization",\n    "name": "eWith.me",\n    "url": "https://ewith.me"\n  },\n  "about": [\n    {\n      "@type": "Thing",\n      "name": "Primary Concept",\n      "sameAs": "https://www.wikidata.org/wiki/Q42"\n    }\n  ]\n}\n</script>\n`,
      faq: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "What is the primary benefit of zero-retention local AI?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "All prompts and documents are processed ephemerally in-memory or on-device with zero persistent server storage."\n      }\n    }\n  ]\n}\n</script>\n`,
      breadcrumb: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "BreadcrumbList",\n  "itemListElement": [\n    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ewith.me/" },\n    { "@type": "ListItem", "position": 2, "name": "Tools", "item": "https://ewith.me/tools" }\n  ]\n}\n</script>\n`,
      job: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "JobPosting",\n  "title": "Senior AI Systems Engineer",\n  "description": "Design and optimize low-latency local WebGPU and ONNX inference pipelines.",\n  "datePosted": "${new Date().toISOString().slice(0, 10)}",\n  "employmentType": "FULL_TIME",\n  "hiringOrganization": {\n    "@type": "Organization",\n    "name": "eWith.me",\n    "sameAs": "https://ewith.me/jobs"\n  }\n}\n</script>\n`
    };

    editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, templates[pick.key]);
    });
  });

  // Command 3: Open Online Studio
  const openWebCmd = vscode.commands.registerCommand('ewithme.openWebTools', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://ewith.me/tools'));
  });

  context.subscriptions.push(auditCmd, insertCmd, openWebCmd);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  analyzeJsonLdBlocks,
  computeReadabilityMetrics
};
