import { BrowserWindow, dialog } from 'electron';
import fs from 'fs/promises';

export type ExportRequest = {
  title: string;
  transcript: string;
  subnotes: { type: string; content: string }[];
  format: 'word' | 'pdf';
};

export class ExportService {
  public async exportNote(request: ExportRequest): Promise<void> {
    const { title, transcript, subnotes, format } = request;

    // Build HTML representation
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: "Microsoft YaHei", sans-serif; line-height: 1.6; color: #333; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h2 { color: #34495e; margin-top: 1.5rem; }
          p { margin-bottom: 1rem; white-space: pre-wrap; }
          .subnote { background: #f9f9f9; padding: 1rem; border-left: 4px solid #3498db; margin-bottom: 1rem; }
          .subnote-title { font-weight: bold; color: #2980b9; margin-bottom: 0.5rem; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${subnotes
          .map(
            (sn) => `
          <div class="subnote">
            <div class="subnote-title">${sn.type}</div>
            <p>${sn.content}</p>
          </div>
        `,
          )
          .join('')}
        <h2>Transcript</h2>
        <p>${transcript}</p>
      </body>
      </html>
    `;

    if (format === 'word') {
      const { filePath } = await dialog.showSaveDialog({
        title: '匯出為 Word / Export as Word',
        defaultPath: `${title.replace(/[\/\\]/g, '_')}.doc`,
        filters: [{ name: 'Word Document', extensions: ['doc'] }],
      });

      if (filePath) {
        // Saving HTML as .doc works well for basic Word opening
        await fs.writeFile(filePath, htmlContent, 'utf-8');
      }
    } else if (format === 'pdf') {
      const { filePath } = await dialog.showSaveDialog({
        title: '匯出為 PDF / Export as PDF',
        defaultPath: `${title.replace(/[\/\\]/g, '_')}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });

      if (filePath) {
        // Render PDF using a hidden BrowserWindow
        const win = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        await win.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
        );

        const pdfData = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
        });

        await fs.writeFile(filePath, pdfData);
        win.destroy();
      }
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  }
}
