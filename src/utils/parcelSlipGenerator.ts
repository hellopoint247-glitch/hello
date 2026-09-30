/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShopOrder } from '../types';

export const ADVANCE_DELIVERY_CHARGE = 150;
export const ADVANCE_SEND_MONEY_NUMBER = '01783586858';

export const BD_DIVISIONS: { bn: string; en: string }[] = [
  { bn: 'ঢাকা', en: 'Dhaka' },
  { bn: 'চট্টগ্রাম', en: 'Chattogram' },
  { bn: 'রাজশাহী', en: 'Rajshahi' },
  { bn: 'খুলনা', en: 'Khulna' },
  { bn: 'বরিশাল', en: 'Barishal' },
  { bn: 'সিলেট', en: 'Sylhet' },
  { bn: 'রংপুর', en: 'Rangpur' },
  { bn: 'ময়মনসিংহ', en: 'Mymensingh' }
];

export const BD_DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  'ঢাকা': [
    'ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'নরসিংদী', 'টাঙ্গাইল', 'কিশোরগঞ্জ',
    'মানিকগঞ্জ', 'মুন্সীগঞ্জ', 'রাজবাড়ী', 'মাদারীপুর', 'গোপালগঞ্জ', 'ফরিদপুর', 'শরীয়তপুর'
  ],
  'চট্টগ্রাম': [
    'চট্টগ্রাম', 'কুমিল্লা', 'ফেনী', 'ব্রাহ্মণবাড়িয়া', 'নোয়াখালী', 'লক্ষ্মীপুর',
    'চাঁদপুর', 'কক্সবাজার', 'রাঙ্গামাটি', 'বান্দরবান', 'খাগড়াছড়ি'
  ],
  'রাজশাহী': [
    'রাজশাহী', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ', 'নাটোর', 'নওগাঁ', 'চাঁপাইনবাবগঞ্জ', 'জয়পুরহাট'
  ],
  'খুলনা': [
    'খুলনা', 'যশোর', 'সাতক্ষীরা', 'কুষ্টিয়া', 'ঝিনাইদহ', 'বাগেরহাট', 'চুয়াডাঙ্গা', 'মাগুরা', 'নড়াইল', 'মেহেরপুর'
  ],
  'বরিশাল': [
    'বরিশাল', 'পটুয়াখালী', 'ভোলা', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি'
  ],
  'সিলেট': [
    'সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ'
  ],
  'রংপুর': [
    'রংপুর', 'দিনাজপুর', 'কুড়িগ্রাম', 'গাইবান্ধা', 'নীলফামারী', 'পঞ্চগড়', 'ঠাকুরগাঁও', 'লালমনিরহাট'
  ],
  'ময়মনসিংহ': [
    'ময়মনসিংহ', 'জামালপুর', 'শেরপুর', 'নেত্রকোনা'
  ]
};

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : ['—'];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generates and downloads a high-resolution Courier Parcel Shipping Label & Invoice PNG
 * designed to be printed or attached directly to the customer's parcel.
 */
export function downloadParcelSlipReport(order: ShopOrder, currency: string = '৳') {
  const width = 920;
  const itemCount = order.items?.length || 1;
  const baseHeight = 980 + Math.max(0, itemCount - 1) * 58;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = baseHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. White Parcel Label Paper Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, baseHeight);

  // Outer dashed cut/border line for parcel pasting
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(18, 18, width - 36, baseHeight - 36);
  ctx.setLineDash([]);

  // Inner solid frame
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, width - 56, baseHeight - 56);

  // 2. Top Brand Header Block
  drawRoundedRect(ctx, 44, 44, width - 88, 118, 16);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  // Brand Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('HELLO POINT (হ্যালো পয়েন্ট)', 68, 92);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('অফিসিয়াল কুরিয়ার পার্সেল স্লিপ ও ক্যাশ মেমো (PARCEL SHIPPING LABEL)', 68, 120);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`মার্চেন্ট হেল্পলাইন / সেন্ড মানি: ${ADVANCE_SEND_MONEY_NUMBER}`, 68, 144);

  // Order Number & Barcode Box on Right of Header
  drawRoundedRect(ctx, width - 310, 58, 246, 90, 12);
  ctx.fillStyle = '#1E293B';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#FACC15';
  ctx.font = '900 20px monospace';
  const orderCode = order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`;
  ctx.fillText(`ORDER: ${orderCode}`, width - 294, 88);

  const dateStr = new Date(order.createdAt).toLocaleString('bn-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  ctx.fillStyle = '#CBD5E1';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`তারিখ: ${dateStr}`, width - 294, 112);

  // Simulated Barcode Bars
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 34; i++) {
    const barW = (i % 3 === 0) ? 4 : (i % 2 === 0 ? 2 : 1.5);
    ctx.fillRect(width - 294 + i * 6.5, 122, barW, 16);
  }

  // 3. Courier COD & Advance Payment Status Banner
  const dueOnDelivery =
    typeof order.dueOnDeliveryAmount === 'number'
      ? order.dueOnDeliveryAmount
      : order.subtotal;
  const advancePaid =
    typeof order.advancePaidAmount === 'number'
      ? order.advancePaidAmount
      : order.deliveryCharge || ADVANCE_DELIVERY_CHARGE;

  drawRoundedRect(ctx, 44, 178, width - 88, 104, 16);
  ctx.fillStyle = '#FEFCE8';
  ctx.fill();
  ctx.strokeStyle = '#EAB308';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#854D0E';
  ctx.font = '900 16px sans-serif';
  ctx.fillText('ডেলিভারি ম্যানের জন্য নির্দেশনা (COLLECTION INSTRUCTION):', 66, 208);

  ctx.fillStyle = '#047857';
  ctx.font = '900 17px sans-serif';
  ctx.fillText(
    `✓ অগ্রিম ডেলিভারি চার্জ পরিশোধিত: ${currency}${advancePaid}  |  সেন্ড মানি TrxID: ${order.transactionId || 'N/A'}`,
    66,
    236
  );

  ctx.fillStyle = '#DC2626';
  ctx.font = '900 22px sans-serif';
  ctx.fillText(
    `পার্সেল ডেলিভারির সময় সংগ্রহযোগ্য (COD AMOUNT): ${currency}${dueOnDelivery.toLocaleString()}`,
    66,
    268
  );

  // 4. Receiver Details Box (প্রাপকের নাম ও মোবাইল নাম্বার)
  drawRoundedRect(ctx, 44, 298, width - 88, 118, 16);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '900 14px sans-serif';
  ctx.fillText('প্রাপকের তথ্য (DELIVER TO / RECEIVER):', 66, 326);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 26px sans-serif';
  ctx.fillText(`নাম: ${order.customerName}`, 66, 362);

  ctx.fillStyle = '#1D4ED8';
  ctx.font = '900 26px monospace';
  ctx.fillText(`মোবাইল: ${order.customerPhone}`, 66, 398);

  // Order Status Badge inside Receiver Box
  const statusLabels: Record<string, string> = {
    pending: 'PENDING (পেন্ডিং)',
    confirmed: 'CONFIRMED (কনফার্মড)',
    shipped: 'SHIPPED (পাঠানো হয়েছে)',
    delivered: 'DELIVERED (ডেলিভারড)',
    cancelled: 'CANCELLED (বাতিল)'
  };
  drawRoundedRect(ctx, width - 290, 316, 224, 44, 10);
  ctx.fillStyle = order.status === 'confirmed' || order.status === 'delivered' ? '#DCFCE7' : '#FEF3C7';
  ctx.fill();
  ctx.strokeStyle = order.status === 'confirmed' || order.status === 'delivered' ? '#16A34A' : '#D97706';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = order.status === 'confirmed' || order.status === 'delivered' ? '#166534' : '#92400E';
  ctx.font = '900 14px sans-serif';
  ctx.fillText(statusLabels[order.status] || order.status.toUpperCase(), width - 274, 344);

  // 5. 3 Separate Cards for Division, District, Thana (বিভাগ, জেলা, থানা আলাদা ৩ কার্ডে)
  const cardTop = 432;
  const cardGap = 16;
  const totalCardsWidth = width - 88;
  const singleCardW = (totalCardsWidth - cardGap * 2) / 3;
  const cardH = 82;

  const locationCards = [
    { label: '১. বিভাগ (DIVISION)', value: order.division || 'উল্লেখ নেই', bg: '#EFF6FF', border: '#60A5FA', text: '#1E3A8A' },
    { label: '২. জেলা (DISTRICT)', value: order.district || 'উল্লেখ নেই', bg: '#F5F3FF', border: '#A78BFA', text: '#4C1D95' },
    { label: '৩. থানা / উপজেলা (THANA)', value: order.thana || 'উল্লেখ নেই', bg: '#ECFDF5', border: '#34D399', text: '#065F46' }
  ];

  locationCards.forEach((c, idx) => {
    const cx = 44 + idx * (singleCardW + cardGap);
    drawRoundedRect(ctx, cx, cardTop, singleCardW, cardH, 14);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(c.label, cx + 16, cardTop + 28);

    ctx.fillStyle = c.text;
    ctx.font = '900 22px sans-serif';
    ctx.fillText(c.value, cx + 16, cardTop + 62);
  });

  // 6. Full Detailed Street/Village Address Box
  drawRoundedRect(ctx, 44, 528, width - 88, 78, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('বিস্তারিত ডেলিভারি ঠিকানা (DETAILED ADDRESS):', 64, 552);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px sans-serif';
  const addrLines = wrapCanvasText(ctx, order.customerAddress || '', width - 130);
  ctx.fillText(addrLines[0] || '', 64, 580);
  if (addrLines[1]) {
    ctx.fillText(addrLines[1], 64, 600);
  }

  // 7. Ordered Products Table Header
  let currentY = 624;
  drawRoundedRect(ctx, 44, currentY, width - 88, 42, 10);
  ctx.fillStyle = '#1E293B';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ক্রমিক', 62, currentY + 26);
  ctx.fillText('পণ্যের বিবরণ (Product Name)', 130, currentY + 26);
  ctx.fillText('পরিমাণ (Qty)', 560, currentY + 26);
  ctx.fillText('দর (Price)', 680, currentY + 26);
  ctx.fillText('মোট (Total)', 785, currentY + 26);

  currentY += 48;

  // Products Rows
  (order.items || []).forEach((item, index) => {
    drawRoundedRect(ctx, 44, currentY, width - 88, 48, 8);
    ctx.fillStyle = index % 2 === 0 ? '#F8FAFC' : '#F1F5F9';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${index + 1}.`, 64, currentY + 30);

    const prodName = (item.name || item.productName || 'পণ্য').slice(0, 38);
    ctx.fillText(prodName, 130, currentY + 30);

    ctx.font = '900 16px sans-serif';
    ctx.fillText(`${item.quantity} পিস`, 565, currentY + 30);

    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${currency}${item.price}`, 680, currentY + 30);

    ctx.font = '900 16px monospace';
    ctx.fillText(`${currency}${item.price * item.quantity}`, 785, currentY + 30);

    currentY += 54;
  });

  // 8. Financial Summary Box
  currentY += 8;
  drawRoundedRect(ctx, 44, currentY, width - 88, 130, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left side note & TrxID
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`সেন্ড মানি নাম্বার: ${ADVANCE_SEND_MONEY_NUMBER}`, 64, currentY + 34);
  ctx.fillText(`কাস্টমার ট্রানজেকশন আইডি (TrxID): ${order.transactionId || 'N/A'}`, 64, currentY + 62);
  if (order.note) {
    ctx.fillText(`নোট: ${order.note.slice(0, 45)}`, 64, currentY + 90);
  }
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('* পার্সেল খোলার সময় অবশ্যই আনবক্সিং ভিডিও ধারণ করবেন।', 64, currentY + 114);

  // Right side totals
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`পণ্যের মোট মূল্য: ${currency}${order.subtotal}`, width - 340, currentY + 32);
  ctx.fillText(`ডেলিভারি চার্জ: +${currency}${order.deliveryCharge || ADVANCE_DELIVERY_CHARGE}`, width - 340, currentY + 56);

  ctx.fillStyle = '#047857';
  ctx.fillText(`অগ্রিম ডেলিভারি পেইড: -${currency}${advancePaid}`, width - 340, currentY + 80);

  ctx.fillStyle = '#DC2626';
  ctx.font = '900 19px sans-serif';
  ctx.fillText(`ডেলিভারির সময় প্রদেয়: ${currency}${dueOnDelivery}`, width - 340, currentY + 112);

  // Trigger PNG Download
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanCode = (order.orderNumber || order.id.slice(-6)).replace(/[^a-zA-Z0-9_-]/g, '');
    link.download = `HelloPoint_Parcel_Slip_${cleanCode}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Failed to download parcel slip PNG:', e);
  }
}
