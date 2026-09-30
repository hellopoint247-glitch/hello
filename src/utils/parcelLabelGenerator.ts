/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShopOrder } from '../types';

/**
 * Generates a high-resolution Courier Parcel Label / Invoice Report PNG
 * designed specifically to be printed or attached to a customer's physical parcel.
 */
export async function downloadParcelLabelImage(order: ShopOrder, currency: string = '৳'): Promise<void> {
  const canvas = document.createElement('canvas');
  const scale = 2; // High-DPI crisp rendering
  const width = 620;

  // Calculate dynamic height based on number of items
  const itemRowsHeight = Math.max(1, order.items.length) * 44;
  const noteHeight = order.note ? 56 : 0;
  const height = 760 + itemRowsHeight + noteHeight;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // 1. White Paper Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Outer Dashed Cut-Line & Solid Courier Frame
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.setLineDash([]);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // 3. Top Header Banner (Merchant / Sender Branding)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(20, 20, width - 40, 88);

  ctx.fillStyle = '#FACC15';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HELLOPOINT ONLINE SHOP', 38, 54);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('প্রেরক: মাহবুব হাসান (হেলোপয়েন্ট শপ)  |  হেল্পলাইন: 01783586858', 38, 76);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('PARCEL SHIPPING LABEL & ORDER INVOICE (পার্সেল ডেলিভারি স্লিপ)', 38, 96);

  // Top Right Badge: COD / Parcel Tag
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, width - 165, 34, 128, 60, 8, true, false);
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ORDER ID', width - 101, 52);
  ctx.fillStyle = '#6D28D9';
  ctx.font = '900 15px monospace';
  ctx.fillText(`#${order.orderNumber}`, width - 101, 72);
  ctx.fillStyle = '#475569';
  ctx.font = '700 10px system-ui, -apple-system, sans-serif';
  const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  ctx.fillText(dateStr, width - 101, 87);

  // 4. Barcode & Order Status Strip
  let y = 122;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(22, y - 12, width - 44, 58);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, y + 46);
  ctx.lineTo(width - 20, y + 46);
  ctx.stroke();

  // Simulated Visual Courier Barcode
  drawBarcode(ctx, 38, y - 4, 210, 34, order.orderNumber);
  ctx.fillStyle = '#334155';
  ctx.font = '700 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`TRACKING: HP-${order.orderNumber}`, 38, y + 41);

  // Advance Delivery Charge & TrxID Box on Right
  ctx.fillStyle = '#ECFDF5';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 270, y - 6, width - 306, 46, 8, true, true);

  ctx.fillStyle = '#065F46';
  ctx.font = '900 11.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  const advAmount = order.advancePaidAmount ?? order.deliveryCharge ?? 150;
  ctx.fillText(`✓ অগ্রিম ডেলিভারি চার্জ: ${currency}${advAmount} (Send Money: 01783586858)`, 282, y + 12);

  ctx.fillStyle = '#047857';
  ctx.font = '900 12px monospace';
  ctx.fillText(`TrxID: ${order.transactionId || 'N/A'}   |   Status: ${order.status.toUpperCase()}`, 282, y + 31);

  // 5. RECEIVER / CUSTOMER DETAILS SECTION (SHIP TO)
  y = 186;
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('প্রাপকের তথ্য ও ডেলিভারি ঠিকানা (DELIVER TO / RECEIVER):', 36, y);

  y += 10;
  ctx.fillStyle = '#FFFBEB';
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  roundRect(ctx, 34, y, width - 68, 76, 10, true, true);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(`নাম: ${order.customerName}`, 48, y + 28);

  ctx.fillStyle = '#B91C1C';
  ctx.font = '900 20px monospace';
  ctx.fillText(`মোবাইল: ${order.customerPhone}`, 48, y + 58);

  // Call Badge
  ctx.fillStyle = '#0F172A';
  roundRect(ctx, width - 170, y + 18, 120, 40, 8, true, false);
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('কাস্টমার নাম্বার', width - 110, y + 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 12px monospace';
  ctx.fillText(order.customerPhone, width - 110, y + 51);

  // 6. THREE SEPARATE CARDS FOR DIVISION, DISTRICT, THANA
  y += 90;
  const cardGap = 10;
  const cardW = (width - 68 - cardGap * 2) / 3;

  const locCards = [
    { label: '১. বিভাগ (DIVISION)', value: order.division || 'উল্লেখ নেই', bg: '#F1F5F9', border: '#64748B' },
    { label: '২. জেলা (DISTRICT)', value: order.district || 'উল্লেখ নেই', bg: '#EEF2FF', border: '#4F46E5' },
    { label: '৩. থানা / উপজেলা (THANA)', value: order.thana || 'উল্লেখ নেই', bg: '#F0FDF4', border: '#16A34A' }
  ];

  locCards.forEach((loc, idx) => {
    const cx = 34 + idx * (cardW + cardGap);
    ctx.fillStyle = loc.bg;
    ctx.strokeStyle = loc.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, y, cardW, 58, 10, true, true);

    ctx.fillStyle = '#475569';
    ctx.font = '800 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(loc.label, cx + 12, y + 20);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(truncateText(ctx, loc.value, cardW - 24), cx + 12, y + 44);
  });

  // 7. Detailed Address Card
  y += 70;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 34, y, width - 68, 64, 10, true, true);

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('বিস্তারিত ডেলিভারি ঠিকানা (FULL STREET / VILLAGE ADDRESS):', 46, y + 20);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 14px system-ui, -apple-system, sans-serif';
  const fullAddrLine = order.customerAddress || `${order.thana || ''}, ${order.district || ''}, ${order.division || ''}`;
  wrapText(ctx, fullAddrLine, 46, y + 42, width - 92, 18, 2);

  if (order.note) {
    y += 74;
    ctx.fillStyle = '#FEF2F2';
    ctx.strokeStyle = '#F87171';
    ctx.lineWidth = 1;
    roundRect(ctx, 34, y, width - 68, 44, 8, true, true);
    ctx.fillStyle = '#991B1B';
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`বিশেষ নোট: ${truncateText(ctx, order.note, width - 160)}`, 46, y + 27);
  }

  // 8. ORDERED PRODUCTS TABLE
  y += order.note ? 58 : 78;
  ctx.fillStyle = '#0F172A';
  roundRect(ctx, 34, y, width - 68, 32, 6, true, false);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 11.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('পণ্যের বিবরণ (Product Name)', 46, y + 20);
  ctx.textAlign = 'center';
  ctx.fillText('পরিমাণ (Qty)', width - 210, y + 20);
  ctx.fillText('দর (Rate)', width - 130, y + 20);
  ctx.textAlign = 'right';
  ctx.fillText('মোট (Total)', width - 46, y + 20);

  y += 32;
  order.items.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(34, y, width - 68, 42);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(34, y, width - 68, 42);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    const itemName = item.name || item.productName || 'পণ্য';
    ctx.fillText(truncateText(ctx, `${idx + 1}. ${itemName}`, 295), 46, y + 26);

    ctx.textAlign = 'center';
    ctx.font = '900 13px monospace';
    ctx.fillText(`${item.quantity} পিস`, width - 210, y + 26);

    ctx.font = '700 12px monospace';
    ctx.fillText(`${currency}${item.price}`, width - 130, y + 26);

    ctx.textAlign = 'right';
    ctx.font = '900 13px monospace';
    ctx.fillText(`${currency}${(item.price * item.quantity).toLocaleString()}`, width - 46, y + 26);

    y += 42;
  });

  // 9. BILL & COD COLLECTION SUMMARY
  y += 14;
  const deliveryFee = order.deliveryCharge ?? 150;
  const advancePaid = order.advancePaidAmount ?? deliveryFee;
  const productSubtotal = order.subtotal || order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal = productSubtotal + deliveryFee;
  const dueOnDelivery = order.dueOnDeliveryAmount ?? productSubtotal;

  // Left Box: Payment Breakdown
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 34, y, 270, 110, 10, true, true);

  ctx.fillStyle = '#334155';
  ctx.font = '700 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('পণ্যের মোট মূল্য:', 48, y + 24);
  ctx.fillText('ডেলিভারি চার্জ:', 48, y + 46);
  ctx.fillText('সর্বমোট বিল:', 48, y + 68);
  ctx.fillStyle = '#047857';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('অগ্রিম পেইড (Send Money):', 48, y + 92);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 12px monospace';
  ctx.fillText(`${currency}${productSubtotal.toLocaleString()}`, 290, y + 24);
  ctx.fillText(`${currency}${deliveryFee.toLocaleString()}`, 290, y + 46);
  ctx.fillText(`${currency}${grandTotal.toLocaleString()}`, 290, y + 68);
  ctx.fillStyle = '#047857';
  ctx.font = '900 12px monospace';
  ctx.fillText(`- ${currency}${advancePaid.toLocaleString()}`, 290, y + 92);

  // Right Box: Big Highlighted COD Collection Box for Courier
  ctx.fillStyle = '#0F172A';
  roundRect(ctx, 316, y, width - 350, 110, 10, true, false);

  ctx.fillStyle = '#FACC15';
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const rightCenter = 316 + (width - 350) / 2;
  ctx.fillText('ডেলিভারির সময় প্রদেয় (COD AMOUNT)', rightCenter, y + 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 30px monospace';
  ctx.fillText(`${currency}${dueOnDelivery.toLocaleString()}/-`, rightCenter, y + 68);

  ctx.fillStyle = '#34D399';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('(১৫০ টাকা ডেলিভারি চার্জ অগ্রিম পরিশোধিত)', rightCenter, y + 94);

  // 10. Footer Instructions
  y += 134;
  ctx.fillStyle = '#475569';
  ctx.font = '700 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    '⚠️ পার্সেল রিসিভ করার সময় অবশ্যই আনবক্সিং ভিডিও ধারণ করবেন। ধন্যবাদান্তে — HelloPoint Online Shop (01783586858)',
    width / 2,
    y
  );

  // Trigger Download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `Parcel_Label_${order.orderNumber}_${order.customerPhone}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean
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
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string
) {
  ctx.fillStyle = '#0F172A';
  let curX = x;
  for (let i = 0; i < 38; i++) {
    const charCode = seed.charCodeAt(i % seed.length) + i * 17;
    const barW = (charCode % 3) + 1.5;
    const gapW = ((charCode >> 2) % 2) + 1.5;
    if (curX + barW > x + w) break;
    ctx.fillRect(curX, y, barW, h);
    curX += barW + gapW;
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
      line = words[n] + ' ';
      lineCount++;
      if (lineCount >= maxLines - 1) {
        const remaining = words.slice(n).join(' ');
        ctx.fillText(truncateText(ctx, remaining, maxWidth), x, y + lineCount * lineHeight);
        return;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
}
