// Feature 3: PDF Generation for Questions & Answers

export function generateRevisionNotePdf(question, answers, bestFitAnswer) {
  if (!question) return;

  const answersHtml = (answers || []).map((ans, idx) => {
    const isTop = bestFitAnswer && bestFitAnswer.id === ans.id;
    return `
      <div style="border: 1px solid ${isTop ? '#2563eb' : '#e2e8f0'}; background: ${isTop ? '#eff6ff' : '#f8fafc'}; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
          <strong>${ans.authorName} (${ans.authorRole || 'Mentor'}) ${ans.authorBadge || ''}</strong>
          <div>
            ${isTop ? '<span style="background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 10px; margin-right: 6px;">★ AI BEST-FIT SOLUTION</span>' : ''}
            <span style="color: #16a34a; font-weight: bold;">+${ans.upvotes || 0} Upvotes</span>
          </div>
        </div>
        <div style="font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${escapeHtml(ans.content)}</div>
      </div>
    `;
  }).join("");

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    alert("Popup blocked! Please allow popups to generate and view the PDF.");
    return;
  }

  const printDocument = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Revision Sheet - ${escapeHtml(question.title)}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .badge { background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; }
        .q-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
        .q-title { font-size: 18px; font-weight: bold; color: #1e3a8a; margin: 0 0 6px 0; }
        .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
        .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #e0e7ff; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span><strong>Academic Doubt Forum</strong> — Revision Sheet Ready for Export</span>
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
      </div>

      <div class="header">
        <div>
          <h2 style="margin: 0; font-size: 20px; color: #1e3a8a;">Academic Doubt Forum</h2>
          <div style="font-size: 12px; color: #64748b;">Verified Peer & AI Solution Revision Sheet</div>
        </div>
        <div>
          <span class="badge">${escapeHtml(question.subjectName || "Subject")}</span>
        </div>
      </div>

      <div class="q-box">
        <h1 class="q-title">${escapeHtml(question.title)}</h1>
        <div style="font-size: 13px; color: #334155;">${escapeHtml(question.description || "")}</div>
        <div class="meta">Asked by <strong>${escapeHtml(question.author?.name || "Student")}</strong> &bull; Date: ${new Date(question.createdAt).toLocaleDateString()}</div>
      </div>

      <div class="section-title">Verified Solutions & Community Answers (${answers.length})</div>
      ${answersHtml || "<p style='color: #64748b;'>No answers submitted yet.</p>"}

      <div class="footer">
        <div>Academic Doubt Forum &bull; Hackathon Revision Sheet</div>
        <div>Generated on ${new Date().toLocaleString()}</div>
      </div>

      <script>
        // Trigger print prompt automatically once loaded
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printDocument);
  printWindow.document.close();
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
