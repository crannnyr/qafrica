import { jsPDF } from 'jspdf';

export type ReceiptCustomer = {
  order_code: string;
  customer_name: string;
  customer_whatsapp?: string | null;
};

export type ReceiptShipment = {
  order_id?: string;
  shipment_code: string;
  status: string;
  created_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  delivery_mode?: string | null;
  notes?: string | null;
  delivery_address?: {
    name: string;
    phone: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    landmark?: string;
  } | null;
  items: Array<{
    product_name: string;
    quantity: number;
    variant_options?: Record<string, unknown> | null;
  }>;
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CARD_W = 148;
const CARD_X = (PAGE_WIDTH - CARD_W) / 2;
const CARD_Y = 18;
const CARD_H = 178;
const INNER_X = CARD_X + 8;
const INNER_W = CARD_W - 16;
const QR_SIZE = 32;
const qrCache = new Map<string, string>();

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/·/g, ' - ')
    .replace(/…/g, '...');
}

function variants(value: Record<string, unknown> | null | undefined) {
  if (!value) return '';
  return Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && String(item).trim())
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(', ');
}

async function loadQr(orderCode: string) {
  const cached = qrCache.get(orderCode);
  if (cached) return cached;

  const trackingUrl = `https://qafrica.store/track?code=${encodeURIComponent(orderCode)}`;
  const response = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=160x160&format=png&data=${encodeURIComponent(trackingUrl)}`,
    { mode: 'cors' },
  );

  if (!response.ok) throw new Error('Could not load the receipt QR code');

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  const dataUrl = `data:image/png;base64,${btoa(binary)}`;
  qrCache.set(orderCode, dataUrl);
  return dataUrl;
}

function drawWatermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setTextColor(241, 243, 246);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('SHIPMENT RECEIPT', PAGE_WIDTH / 2, CARD_Y + 110, {
    align: 'center',
    angle: 35,
  });
  doc.restoreGraphicsState();
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  align: 'left' | 'right' = 'left',
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(156, 163, 175);
  doc.text(label, x, y, { align });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  const width = 55;
  const lines = doc.splitTextToSize(clean(value), width) as string[];
  doc.text(lines.slice(0, 2), x, y + 5, { align });
}

async function addReceiptPage(
  doc: jsPDF,
  shipment: ReceiptShipment,
  customer: ReceiptCustomer,
) {
  const qr = await loadQr(customer.order_code);
  const address = shipment.delivery_address;
  const addressText = address
    ? [address.address_line1, address.address_line2].filter(Boolean).join(', ')
    : '';
  const cityState = address ? [address.city, address.state].filter(Boolean).join(', ') : '';

  drawWatermark(doc);

  doc.setDrawColor(224, 228, 234);
  doc.setLineWidth(0.35);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 5, 5, 'S');

  // Header — matches the supplied receipt design.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text('QAFRICA', INNER_X, CARD_Y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Shipment receipt', INNER_X, CARD_Y + 22);

  doc.addImage(qr, 'PNG', CARD_X + CARD_W - 8 - QR_SIZE, CARD_Y + 10, QR_SIZE, QR_SIZE);

  let y = CARD_Y + 42;

  // Shipment code block.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  doc.text('SHIPMENT CODE', PAGE_WIDTH / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(clean(shipment.shipment_code), PAGE_WIDTH / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Order ' + clean(customer.order_code), PAGE_WIDTH / 2, y, { align: 'center' });

  y += 14;

  // Customer/status row.
  drawLabelValue(doc, 'Customer', customer.customer_name, INNER_X, y);
  drawLabelValue(doc, 'Status', clean(shipment.status.replaceAll('_', ' ')), CARD_X + CARD_W - 8, y, 'right');

  y += 20;

  // Carrier/delivery row.
  drawLabelValue(doc, 'Carrier', shipment.carrier_name || 'QAfrica', INNER_X, y);
  drawLabelValue(doc, 'Delivery', clean((shipment.delivery_mode || '—').replaceAll('_', ' ')), CARD_X + CARD_W - 8, y, 'right');

  y += 18;

  // Delivery address card.
  if (address) {
    const addressCardY = y - 2;
    const addressCardH = 29;
    doc.setDrawColor(235, 238, 242);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(INNER_X, addressCardY, INNER_W, addressCardH, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(156, 163, 175);
    doc.text('DELIVER TO', INNER_X + 4, addressCardY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    const recipient = [address.name, address.phone].filter(Boolean).join(' · ');
    doc.text(clean(recipient), INNER_X + 4, addressCardY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(75, 85, 99);
    doc.text(doc.splitTextToSize(clean(addressText), INNER_W - 8).slice(0, 1), INNER_X + 4, addressCardY + 21);
    doc.text(clean(cityState), INNER_X + 4, addressCardY + 26);

    y = addressCardY + addressCardH + 10;
  }

  // Product table.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(107, 114, 128);
  doc.text('ITEM', INNER_X, y);
  doc.text('QTY', CARD_X + CARD_W - 8, y, { align: 'right' });

  doc.setDrawColor(220, 224, 229);
  doc.setLineWidth(0.45);
  doc.line(INNER_X, y + 4, CARD_X + CARD_W - 8, y + 4);

  y += 12;

  for (const item of shipment.items) {
    const productLines = doc.splitTextToSize(clean(item.product_name), INNER_W - 16) as string[];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text(productLines.slice(0, 2), INNER_X, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(item.quantity), CARD_X + CARD_W - 8, y, { align: 'right' });

    y += Math.max(6, Math.min(productLines.length, 2) * 4);

    const variant = variants(item.variant_options);
    if (variant) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(156, 163, 175);
      const detailLines = doc.splitTextToSize(variant, INNER_W - 2) as string[];
      doc.text(detailLines.slice(0, 2), INNER_X, y);
      y += Math.min(detailLines.length, 2) * 3.5;
    }

    doc.setDrawColor(235, 238, 242);
    doc.setLineWidth(0.2);
    doc.line(INNER_X, y + 2, CARD_X + CARD_W - 8, y + 2);
    y += 8;
  }

  if (!shipment.items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('No product details available for this shipment.', INNER_X, y);
    y += 10;
  }

  if (shipment.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(doc.splitTextToSize('Note: ' + clean(shipment.notes), INNER_W).slice(0, 2), INNER_X, y);
    y += 10;
  }

  if (shipment.delivered_at) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 163, 74);
    doc.text('Delivered ' + new Date(shipment.delivered_at).toLocaleString('en-NG'), INNER_X, y);
    y += 8;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(209, 213, 219);
  doc.text('Scan the QR code to track the order.', PAGE_WIDTH / 2, CARD_Y + CARD_H - 7, { align: 'center' });
}

export async function createShipmentReceiptsPdf(
  shipments: ReceiptShipment[],
  customerByOrder: Map<string, ReceiptCustomer>,
) {
  if (!shipments.length) throw new Error('There are no shipments to include');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.viewerPreferences({ PrintScaling: 'None', NumCopies: 1 });

  for (let index = 0; index < shipments.length; index += 1) {
    if (index > 0) doc.addPage('a4', 'portrait');

    const shipment = shipments[index];
    const customer = customerByOrder.get(shipment.order_id ?? '') ?? {
      order_code: '—',
      customer_name: 'Customer',
      customer_whatsapp: null,
    };

    await addReceiptPage(doc, shipment, customer);
  }

  return doc;
}

export async function downloadShipmentReceipts(
  shipments: ReceiptShipment[],
  customerByOrder: Map<string, ReceiptCustomer>,
  filename: string,
) {
  const doc = await createShipmentReceiptsPdf(shipments, customerByOrder);
  doc.save(filename);
}

export async function printShipmentReceipts(
  shipments: ReceiptShipment[],
  customerByOrder: Map<string, ReceiptCustomer>,
) {
  // Open the window synchronously from the button click to avoid popup blocking.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('The print window was blocked. Please allow pop-ups for QAfrica and try again.');
  }

  try {
    const doc = await createShipmentReceiptsPdf(shipments, customerByOrder);
    const blobUrl = URL.createObjectURL(doc.output('blob'));

    printWindow.document.title = 'QAfrica shipment receipts';
    printWindow.location.href = blobUrl;

    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // PDF viewer can own the print surface; the PDF remains open for manual printing.
      }
    }, 1200);

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
