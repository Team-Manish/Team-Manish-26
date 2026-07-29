import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateCSV(headers, rows, filename) {
  if (!headers?.length || !rows?.length) {
    throw new Error('No data to export');
  }

  const esc = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, sanitizeFilename(`${filename}.csv`));
}

export function generatePDF({ title, subtitle, headers, rows, chartCanvases = [], filename }) {
  if (!title) {
    throw new Error('PDF title is required');
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - 2 * margin;
  let pageNum = 1;

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text(
      `EduTrack | Page ${pageNum} | ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  const addPageIfNeeded = (needed) => {
    const currentY = doc.autoTable ? doc.lastAutoTable?.finalY || margin : margin;
    if (currentY + needed > pageHeight - 15) {
      addFooter();
      doc.addPage();
      pageNum++;
      return margin + 10;
    }
    return currentY;
  };

  let y = margin + 5;

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    y += 3;
  }

  doc.setFontSize(7);
  doc.setTextColor(160);
  doc.text(
    `Generated ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 8;
  doc.setTextColor(0);

  let chartY = y;
  for (const canvas of chartCanvases) {
    if (!canvas) continue;
    try {
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = usableWidth;
      const aspectRatio = canvas.height / canvas.width;
      let imgHeight = imgWidth * aspectRatio;
      imgHeight = Math.min(imgHeight, 90);

      if (chartY + imgHeight + 8 > pageHeight - 15) {
        addFooter();
        doc.addPage();
        pageNum++;
        chartY = margin + 5;
      }

      doc.addImage(imgData, 'PNG', margin, chartY, imgWidth, imgHeight);
      chartY += imgHeight + 6;
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(160);
      doc.text('(chart image unavailable)', margin, chartY + 10);
      chartY += 12;
    }
  }

  if (headers?.length && rows?.length) {
    const startY = Math.max(chartY + 4, y + 4);

    doc.autoTable({
      startY,
      head: [headers],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
      didDrawPage: () => {
        addFooter();
      },
    });
  } else {
    addFooter();
  }

  doc.save(sanitizeFilename(`${filename}.pdf`));
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-');
}

export function captureChartCanvases(containerRef) {
  if (!containerRef?.current) return [];
  const canvases = containerRef.current.querySelectorAll('canvas');
  return Array.from(canvases);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
