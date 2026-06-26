// src/pages/dashboard/Jumia/generateJumiaLabel.ts
// Client-side PDF shipping label generator using jsPDF + JsBarcode.
// Call generateJumiaLabel(submission, storeName) to trigger a download.
// Also used for re-downloads from the submissions list.
// No server needed — runs entirely in the browser.

import type { JumiaSubmission } from '@/stores/jumiaStore';

// Dynamic imports so jsPDF/JsBarcode are not bundled unless needed
async function loadDeps() {
  const [{ jsPDF }, JsBarcode] = await Promise.all([
    import('jspdf'),
    import('jsbarcode'),
  ]);
  return { jsPDF, JsBarcode: JsBarcode.default ?? JsBarcode };
}

function variantSummary(s: JumiaSubmission): string {
  if (s.variant_type === 'none') return `${s.quantity_sent} unit(s)`;
  return s.variants
    .map((v) => {
      const lbl = v.colour && v.size ? `${v.colour} / ${v.size}` : v.colour ?? v.size ?? '';
      return `${lbl}: ${v.quantity_sent}`;
    })
    .join(', ');
}

export async function generateJumiaLabel(
  submission: JumiaSubmission,
  storeName: string,
  ownerName: string,
): Promise<void> {
  const { jsPDF, JsBarcode } = await loadDeps();

  // ── Generate barcode as a data URL via a hidden canvas ──────────────────
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, submission.payment_reference ?? submission.id.slice(0, 12).toUpperCase(), {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 12,
    margin: 8,
  });
  const barcodeDataUrl = canvas.toDataURL('image/png');

  // ── PDF layout ────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const W = 148; // A5 width mm
  const pad = 12;
  let y = pad;

  // Header band
  doc.setFillColor(249, 115, 22); // orange-500
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('QAFRICA × JUMIA', pad, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Shipping Label — Print and paste on your package', pad, 20);
  y = 30;

  // Reset text color
  doc.setTextColor(17, 24, 39);

  // Barcode (centered)
  const bcW = 100;
  const bcX = (W - bcW) / 2;
  doc.addImage(barcodeDataUrl, 'PNG', bcX, y, bcW, 28);
  y += 32;

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(pad, y, W - pad, y);
  y += 6;

  // Details table
  const rows: [string, string][] = [
    ['Reference', submission.payment_reference ?? submission.id.slice(0, 12).toUpperCase()],
    ['Store', storeName],
    ['Seller', ownerName],
    ['Contact', submission.contact_phone || '—'],
    ['Item', submission.name],
    ['Category', submission.category],
    ['Stock', variantSummary(submission)],
  ];

  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(label.toUpperCase(), pad, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(value, W - pad - 46);
    doc.text(lines, 46, y);
    y += 6 * (Array.isArray(lines) ? lines.length : 1);
  }

  y += 4;
  doc.setDrawColor(229, 231, 235);
  doc.line(pad, y, W - pad, y);
  y += 6;

  // Instructions box
  doc.setFillColor(254, 243, 199); // amber-100
  doc.roundedRect(pad, y, W - pad * 2, 38, 2, 2, 'F');
  doc.setTextColor(146, 64, 14); // amber-800
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT INSTRUCTIONS', pad + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  const instructions = [
    '1. Print this label and paste it on the outside of your package.',
    '2. Ensure the package is properly sealed before dropping off.',
    '3. Drop off at your chosen Jumia VDO location only when notified.',
    '4. Keep a photo of this label for your records.',
  ];
  doc.setTextColor(120, 53, 15);
  instructions.forEach((line, i) => {
    doc.text(line, pad + 4, y + 14 + i * 6);
  });
  y += 44;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })} · Qafrica Jumia Reseller Platform`,
    pad, y + 4,
  );

  // Save
  const filename = `jumia-label-${(submission.payment_reference ?? submission.id).slice(-8)}.pdf`;
  doc.save(filename);
}
