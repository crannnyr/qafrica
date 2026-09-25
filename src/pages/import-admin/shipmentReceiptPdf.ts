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

const PAGE_WIDTH = 105;
const PAGE_HEIGHT = 148;
const CARD_X = 4;
const CARD_Y = 4;
const CARD_W = 97;
const CARD_H = 140;
const INNER_X = 9;
const INNER_W = 87;
const QR_SIZE = 17;
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

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function addWrappedText(doc: jsPDF, value: string, x: number, y: number, width: number, lineHeight: number) {
  const lines = doc.splitTextToSize(clean(value), width) as string[];
  doc.text(lines, x, y);
  return y + Math.max(1, lines.length) * lineHeight;
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
  doc.setTextColor(244, 244, 244);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SHIPMENT RECEIPT', PAGE_WIDTH / 2, 92, {
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
  doc.setFontSize(6.5);
  doc.setTextColor(165, 174, 188);
  doc.text(label, x, y, { align });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(clean(value), x, y + 6, { align });
}

async function addReceiptPage(
  doc: jsPDF,
  shipment: ReceiptShipment,
  customer: ReceiptCustomer,
) {
  const qr = await loadQr(customer.order_code);

  drawWatermark(doc);

  doc.setDrawColor(224, 228, 234);
  doc.setLineWidth(0.45);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 5, 5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('QAFRICA', INNER_X, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('Shipment receipt', INNER_X, 19);

  doc.addImage(qr, 'PNG', PAGE_WIDTH - INNER_X - QR_SIZE, 7, QR_SIZE, QR_SIZE);

  doc.setFontSize(6.5);
  doc.text('SHIPMENT CODE', PAGE_WIDTH / 2, 30, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(clean(shipment.shipment_code), PAGE_WIDTH / 2, 37, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`Order ${clean(customer.order_code)}`, PAGE_WIDTH / 2, 43, { align: 'center' });

  drawLabelValue(doc, 'Customer', customer.customer_name, INNER_X, 51);
  drawLabelValue(
    doc,
    'Status',
    clean(shipment.status.replaceAll('_', ' ')),
    PAGE_WIDTH - INNER_X,
    51,
    'right',
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  if (customer.customer_whatsapp) doc.text(clean(customer.customer_whatsapp), INNER_X, 62);
  doc.text(formatDate(shipment.created_at), PAGE_WIDTH - INNER_X, 62, { align: 'right' });

  drawLabelValue(doc, 'Carrier', shipment.carrier_name || 'QAfrica', INNER_X, 69);
  drawLabelValue(
    doc,
    'Delivery',
    clean((shipment.delivery_mode || '-').replaceAll('_', ' ')),
    PAGE_WIDTH - INNER_X,
    69,
    'right',
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  if (shipment.tracking_number) {
    doc.text(`Tracking: ${clean(shipment.tracking_number)}`, INNER_X, 80);
  }
  if (shipment.shipped_at) {
    doc.text(`Shipped ${formatDate(shipment.shipped_at)}`, PAGE_WIDTH - INNER_X, 80, { align: 'right' });
  }

  const address = shipment.delivery_address;
  if (address) {
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(235, 238, 242);
    doc.roundedRect(INNER_X, 84, INNER_W, 23, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(156, 163, 175);
    doc.text('DELIVER TO', INNER_X + 2, 89);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(31, 41, 55);
    doc.text(clean(`${address.name} - ${address.phone}`), INNER_X + 2, 95);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(75, 85, 99);
    const addressText = [
      address.address_line1,
      address.address_line2,
      `${address.city}, ${address.state}`,
    ].filter(Boolean).join(', ');
    addWrappedText(doc, addressText, INNER_X + 2, 100, INNER_W - 4, 3.2);
  }

  let y = address ? 111 : 86;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('ITEM', INNER_X, y);
  doc.text('QTY', PAGE_WIDTH - INNER_X, y, { align: 'right' });

  doc.setDrawColor(220, 224, 229);
  doc.setLineWidth(0.8);
  doc.line(INNER_X, y + 3, PAGE_WIDTH - INNER_X, y + 3);
  y += 8;

  for (const item of shipment.items) {
    const variant = variants(item.variant_options);
    const productLines = doc.splitTextToSize(clean(item.product_name), INNER_W - 12) as string[];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(31, 41, 55);
    doc.text(productLines, INNER_X, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(item.quantity), PAGE_WIDTH - INNER_X, y, { align: 'right' });

    y += Math.max(4, productLines.length * 3.2);

    if (variant) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(156, 163, 175);
      y = addWrappedText(doc, variant, INNER_X, y, INNER_W - 12, 2.8);
    }

    doc.setDrawColor(235, 238, 242);
    doc.setLineWidth(0.3);
    doc.line(INNER_X, y + 1.5, PAGE_WIDTH - INNER_X, y + 1.5);
    y += 4;
  }

  if (shipment.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    addWrappedText(doc, `Note: ${shipment.notes}`, INNER_X, Math.min(y, 127), INNER_W, 3);
  }

  if (shipment.delivered_at) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(25, 130, 80);
    doc.text(
      `Delivered ${new Date(shipment.delivered_at).toLocaleString('en-NG')}`,
      INNER_X,
      Math.min(y + 3, 132),
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(209, 213, 219);
  doc.text('Scan the QR code to track the order.', PAGE_WIDTH / 2, 142, { align: 'center' });
}

export async function createShipmentReceiptsPdf(
  shipments: ReceiptShipment[],
  customerByOrder: Map<string, ReceiptCustomer>,
) {
  if (!shipments.length) throw new Error('There are no shipments to include');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
    compress: true,
  });

  for (let index = 0; index < shipments.length; index += 1) {
    if (index > 0) doc.addPage('a6', 'portrait');

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
