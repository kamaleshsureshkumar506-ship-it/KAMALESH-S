import { getPoemSlug } from './slug.js';

/**
 * Generates a 1080x1350 PNG poetry card in the site's navy and gold aesthetic
 * and triggers a client-side download.
 *
 * @param {Object} poem - The poem object containing title, content, author, category, etc.
 * @returns {Promise<boolean>}
 */
export async function downloadPoemCard(poem) {
  if (!poem) return false;

  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Ensure fonts are loaded
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('bold 48px "Noto Serif Tamil"'),
        document.fonts.load('600 32px "Noto Serif Tamil"'),
        document.fonts.load('400 30px "Noto Serif Tamil"'),
        document.fonts.load('600 22px "Noto Sans Tamil"'),
        document.fonts.load('500 20px "Noto Sans Tamil"')
      ]);
      await document.fonts.ready;
    } catch {
      // Continue even if font load probe throws
    }
  }

  // 1. Deep Navy Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060c16');
  bgGrad.addColorStop(0.35, '#0b1627');
  bgGrad.addColorStop(0.75, '#102038');
  bgGrad.addColorStop(1, '#172b49');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle Golden/Ember Ambient Radial Glows
  const topGlow = ctx.createRadialGradient(width / 2, 280, 20, width / 2, 280, 520);
  topGlow.addColorStop(0, 'rgba(224, 127, 46, 0.16)');
  topGlow.addColorStop(0.5, 'rgba(239, 156, 78, 0.05)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const bottomGlow = ctx.createRadialGradient(width - 150, height - 150, 20, width - 150, height - 150, 420);
  bottomGlow.addColorStop(0, 'rgba(224, 127, 46, 0.10)');
  bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, width, height);

  // Helper to draw gold diamonds
  const drawDiamond = (x, y, size, color = '#ef9c4e') => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // 3. Ornate Double Gold Borders
  // Outer frame
  ctx.save();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  // Inner frame with subtle opacity
  ctx.strokeStyle = 'rgba(224, 127, 46, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(62, 62, width - 124, height - 124);

  // Corner decorative diamond accents
  const corners = [
    [62, 62],
    [width - 62, 62],
    [62, height - 62],
    [width - 62, height - 62]
  ];
  corners.forEach(([cx, cy]) => {
    drawDiamond(cx, cy, 7, '#ef9c4e');
  });

  // Corner brackets
  ctx.strokeStyle = '#ef9c4e';
  ctx.lineWidth = 2;
  const bLen = 28;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(76, 76 + bLen);
  ctx.lineTo(76, 76);
  ctx.lineTo(76 + bLen, 76);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(width - 76 - bLen, 76);
  ctx.lineTo(width - 76, 76);
  ctx.lineTo(width - 76, 76 + bLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(76, height - 76 - bLen);
  ctx.lineTo(76, height - 76);
  ctx.lineTo(76 + bLen, height - 76);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(width - 76 - bLen, height - 76);
  ctx.lineTo(width - 76, height - 76);
  ctx.lineTo(width - 76, height - 76 - bLen);
  ctx.stroke();
  ctx.restore();

  // 4. Seal Emblem (Header)
  const sealY = 140;
  const sealR = 42;

  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, sealY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = '#102038';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e07f2e';
  ctx.stroke();

  // Dashed inner circle
  ctx.beginPath();
  ctx.arc(width / 2, sealY, sealR - 7, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#ef9c4e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Letter "க"
  ctx.font = 'bold 36px "Noto Serif Tamil", serif';
  ctx.fillStyle = '#fbe5c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('க', width / 2, sealY + 2);
  ctx.restore();

  // 5. Category Badge
  ctx.save();
  ctx.font = '600 20px "Noto Sans Tamil", sans-serif';
  ctx.fillStyle = '#ef9c4e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const catText = `✦  ${poem.category || 'தமிழ் கவிதை'}  ✦`;
  ctx.fillText(catText, width / 2, 218);
  ctx.restore();

  // 6. Poem Title
  ctx.save();
  ctx.font = 'bold 44px "Noto Serif Tamil", serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure title and shrink if needed
  let titleFontSize = 44;
  let titleWidth = ctx.measureText(poem.title || '').width;
  while (titleWidth > 860 && titleFontSize > 28) {
    titleFontSize -= 2;
    ctx.font = `bold ${titleFontSize}px "Noto Serif Tamil", serif`;
    titleWidth = ctx.measureText(poem.title || '').width;
  }
  ctx.fillText(poem.title || '', width / 2, 280);

  // Decorative Title Divider
  const divGrad = ctx.createLinearGradient(320, 326, width - 320, 326);
  divGrad.addColorStop(0, 'rgba(224, 127, 46, 0)');
  divGrad.addColorStop(0.5, 'rgba(239, 156, 78, 0.85)');
  divGrad.addColorStop(1, 'rgba(224, 127, 46, 0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(320, 326);
  ctx.lineTo(width - 320, 326);
  ctx.stroke();
  drawDiamond(width / 2, 326, 5, '#ef9c4e');
  ctx.restore();

  // 7. Poem Content (Line by line in site's Tamil font)
  // Split raw text by newline to preserve user's stanza structure
  const rawLines = (poem.content || '').trim().split('\n');

  // Available vertical area for poem body:
  const poemAreaTop = 380;
  const poemAreaBottom = 1060;
  const availableHeight = poemAreaBottom - poemAreaTop;
  const maxContentWidth = 880;

  // Determine ideal font size and line height based on line count
  const lineCount = rawLines.length;
  let fontSize = 32;
  let lineHeight = 54;

  if (lineCount <= 6) {
    fontSize = 38;
    lineHeight = 66;
  } else if (lineCount <= 10) {
    fontSize = 33;
    lineHeight = 56;
  } else if (lineCount <= 14) {
    fontSize = 28;
    lineHeight = 48;
  } else if (lineCount <= 18) {
    fontSize = 25;
    lineHeight = 42;
  } else {
    fontSize = Math.max(20, Math.floor(availableHeight / (lineCount * 1.5)));
    lineHeight = Math.floor(fontSize * 1.55);
  }

  // Check if any line exceeds maxContentWidth, shrink font size if so
  ctx.font = `400 ${fontSize}px "Noto Serif Tamil", serif`;
  let widestLine = 0;
  rawLines.forEach((l) => {
    const w = ctx.measureText(l).width;
    if (w > widestLine) widestLine = w;
  });

  if (widestLine > maxContentWidth) {
    const scale = maxContentWidth / widestLine;
    fontSize = Math.max(19, Math.floor(fontSize * scale));
    lineHeight = Math.floor(fontSize * 1.55);
  }

  // Ensure total block fits within availableHeight
  let totalPoemHeight = (lineCount - 1) * lineHeight;
  if (totalPoemHeight > availableHeight) {
    lineHeight = Math.floor(availableHeight / Math.max(1, lineCount - 1));
    totalPoemHeight = (lineCount - 1) * lineHeight;
  }

  // Vertically center the poem in the allocated area
  const startY = poemAreaTop + Math.max(0, (availableHeight - totalPoemHeight) / 2);

  ctx.save();
  ctx.font = `400 ${fontSize}px "Noto Serif Tamil", serif`;
  ctx.fillStyle = '#f6f2ea'; // soft glowing parchment white on navy
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  rawLines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    if (line.trim().length > 0) {
      ctx.fillText(line.trim(), width / 2, y);
    }
  });
  ctx.restore();

  // 8. Poet Name Section
  const authorY = 1140;

  // Thin decorative separator above author
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 156, 78, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, authorY - 32);
  ctx.lineTo(width / 2 + 120, authorY - 32);
  ctx.stroke();
  drawDiamond(width / 2, authorY - 32, 4, '#ef9c4e');

  // Poet Name
  ctx.font = '600 28px "Noto Serif Tamil", serif';
  ctx.fillStyle = '#ef9c4e'; // Golden/Ember
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const authorName = poem.author && poem.author.trim() ? poem.author.trim() : 'கவிஞன் கமலேஷ்';
  ctx.fillText(`— ${authorName} —`, width / 2, authorY);
  ctx.restore();

  // 9. Site Address Visible Footer Watermark
  const watermarkY = 1245;

  ctx.save();
  // Watermark capsule pill background
  const pillW = 420;
  const pillH = 38;
  const pillX = (width - pillW) / 2;
  const pillY = watermarkY - pillH / 2;
  const pillR = 19;

  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.arc(pillX + pillW - pillR, pillY + pillR, pillR, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.arc(pillX + pillR, pillY + pillR, pillR, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10, 22, 39, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(224, 127, 46, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Watermark Text
  ctx.font = '500 20px "Noto Sans Tamil", sans-serif';
  ctx.fillStyle = '#b3c7e0'; // Crisp visible watermark text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('tamil-kavithai-delta.vercel.app', width / 2, watermarkY);
  ctx.restore();

  // 10. Trigger PNG Download
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const slug = getPoemSlug(poem) || 'kavithai';
      link.href = url;
      link.download = `${slug}-card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve(true);
    }, 'image/png');
  });
}

