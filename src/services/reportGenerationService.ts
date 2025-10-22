/**
 * Report Generation Service - Creates structured reports in multiple formats
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { ResearchReport, Citation } from '../types/index.js';
import { Logger, sanitizeFilename } from '../utils/index.js';
import { config } from '../config/index.js';
import { createWriteStream } from 'fs';

const logger = new Logger('ReportGenerator');

export class ReportGenerationService {
  /**
   * Generate report in all configured formats
   */
  async generateReport(report: ResearchReport): Promise<string[]> {
    const outputPaths: string[] = [];

    // Ensure output directory exists
    await mkdir(config.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${sanitizeFilename(report.topic)}_${timestamp}`;

    // Generate each requested format
    for (const format of config.reportFormats) {
      try {
        if (format === 'markdown') {
          const path = await this.generateMarkdown(report, baseFilename);
          outputPaths.push(path);
        } else if (format === 'pdf') {
          const path = await this.generatePDF(report, baseFilename);
          outputPaths.push(path);
        } else if (format === 'googledocs') {
          const url = await this.generateGoogleDoc(report, baseFilename);
          if (url) {
            outputPaths.push(url);
          }
        }
      } catch (error) {
        logger.error(`Failed to generate ${format} report: ${error}`);
      }
    }

    return outputPaths;
  }

  /**
   * Generate Markdown report (Academic format)
   */
  private async generateMarkdown(report: ResearchReport, baseFilename: string): Promise<string> {
    logger.info('Generating academic Markdown report...');

    let markdown = `# ${report.topic}\n\n`;
    
    // Title page information
    markdown += `---\n\n`;
    markdown += `**Research Report**\n\n`;
    markdown += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;
    markdown += `**Number of Sources:** ${report.citations.length}\n\n`;
    markdown += `---\n\n`;
    
    // Abstract/Executive Summary
    markdown += `## Abstract\n\n${report.summary}\n\n`;
    markdown += `---\n\n`;

    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    report.sections.forEach((section, idx) => {
      markdown += `${idx + 1}. [${section.title}](#${this.slugify(section.title)})\n`;
      if (section.subsections && section.subsections.length > 0) {
        section.subsections.forEach((sub, subIdx) => {
          markdown += `   ${String.fromCharCode(97 + subIdx)}. [${sub.title}](#${this.slugify(sub.title)})\n`;
        });
      }
    });
    markdown += `${report.sections.length + 1}. [References](#references)\n`;
    markdown += '\n---\n\n';

    // Main sections
    report.sections.forEach((section, idx) => {
      markdown += this.renderSection(section, 2, report.citations, idx + 1);
      markdown += `\n---\n\n`;
    });

    // Visualizations (if any)
    if (report.visualizations && report.visualizations.length > 0) {
      markdown += `## Appendix: Data Visualizations\n\n`;
      report.visualizations.forEach(viz => {
        markdown += `### ${viz.title}\n\n`;
        markdown += `${viz.description}\n\n`;
        if (viz.type === 'table') {
          markdown += this.renderTable(viz.data);
        }
        markdown += '\n';
      });
      markdown += `\n---\n\n`;
    }

    // References (APA-style format)
    markdown += `## References\n\n`;
    report.citations.forEach((citation, idx) => {
      markdown += `[${idx + 1}] ${this.formatCitationAPA(citation)}\n\n`;
    });

    // Save to file
    const filepath = join(config.outputDir, `${baseFilename}.md`);
    await writeFile(filepath, markdown, 'utf-8');

    logger.success(`Academic Markdown report saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Generate PDF report (Academic format)
   */
  private async generatePDF(report: ResearchReport, baseFilename: string): Promise<string> {
    logger.info('Generating academic PDF report...');

    return new Promise((resolve, reject) => {
      const filepath = join(config.outputDir, `${baseFilename}.pdf`);
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: report.topic,
          Author: 'AutoResearch Agent',
          Subject: report.topic,
          Keywords: 'research, academic, report',
        }
      });
      const stream = createWriteStream(filepath);

      doc.pipe(stream);

      // Title Page
      doc.moveDown(4);
      const cleanTopicTitle = this.cleanMarkdownForPDF(report.topic);
      doc.fontSize(26).font('Helvetica-Bold').text(cleanTopicTitle.toUpperCase(), { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica').text('_'.repeat(50), { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(16).font('Helvetica-Bold').text('Academic Research Report', { align: 'center' });
      doc.moveDown(4);
      doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'center' });
      doc.fontSize(11).text(`Number of Sources Cited: ${report.citations.length}`, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11).text(`Generated by AutoResearch Agent`, { align: 'center' });
      doc.moveDown(3);
      
      // New page for abstract
      doc.addPage();
      
      // Abstract
      doc.fontSize(16).font('Helvetica-Bold').text('Abstract');
      doc.moveDown();
      const cleanSummary = this.cleanMarkdownForPDF(report.summary);
      doc.fontSize(11).font('Helvetica').text(cleanSummary, { align: 'justify' });
      doc.moveDown(2);

      // Table of Contents
      doc.fontSize(16).font('Helvetica-Bold').text('Table of Contents');
      doc.moveDown();
      report.sections.forEach((section, idx) => {
        const cleanSectionTitle = this.cleanMarkdownForPDF(section.title);
        doc.fontSize(11).font('Helvetica').text(`${idx + 1}. ${cleanSectionTitle}`, { continued: false });
        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach((sub, subIdx) => {
            const cleanSubTitle = this.cleanMarkdownForPDF(sub.title);
            doc.fontSize(10).text(`   ${String.fromCharCode(97 + subIdx)}. ${cleanSubTitle}`, { indent: 20 });
          });
        }
      });
      doc.fontSize(11).text(`${report.sections.length + 1}. References`);
      doc.moveDown(2);

      // New page for main content
      doc.addPage();

      // Sections
      report.sections.forEach((section, idx) => {
        this.renderPDFSection(doc, section, 14, idx + 1);
      });

      // References
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('References');
      doc.moveDown();
      report.citations.forEach((citation, idx) => {
        const cleanCitation = this.cleanMarkdownForPDF(this.formatCitationAPA(citation));
        doc.fontSize(10).font('Helvetica').text(`[${idx + 1}] ${cleanCitation}`, {
          align: 'left',
          indent: 20,
          paragraphGap: 8
        });
      });

      doc.end();

      stream.on('finish', () => {
        logger.success(`Academic PDF report saved to: ${filepath}`);
        resolve(filepath);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Generate Google Doc report
   */
  private async generateGoogleDoc(report: ResearchReport, baseFilename: string): Promise<string | null> {
    logger.info('Generating Google Docs report...');

    try {
      // Check if Google credentials are configured
      if (!config.googleClientId || !config.googleClientSecret) {
        logger.warn('Google Docs export skipped: Google OAuth credentials not configured');
        logger.info('To enable Google Docs export, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
        return null;
      }

      // For now, save as markdown with a note about Google Docs
      const markdownPath = join(config.outputDir, `${baseFilename}_googledocs.md`);
      
      let markdown = `# ${report.topic}\n\n`;
      markdown += `> **Note:** This file is formatted for Google Docs import.\n`;
      markdown += `> To import: 1) Go to docs.google.com, 2) File > Open > Upload, 3) Select this file\n\n`;
      markdown += `---\n\n`;
      
      // Add metadata
      markdown += `**Research Report**\n\n`;
      markdown += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;
      markdown += `**Number of Sources:** ${report.citations.length}\n\n`;
      markdown += `---\n\n`;
      
      // Abstract
      markdown += `## Abstract\n\n${report.summary}\n\n`;
      markdown += `---\n\n`;

      // Table of Contents
      markdown += `## Table of Contents\n\n`;
      report.sections.forEach((section, idx) => {
        markdown += `${idx + 1}. ${section.title}\n`;
      });
      markdown += `${report.sections.length + 1}. References\n`;
      markdown += '\n---\n\n';

      // Main sections
      report.sections.forEach((section, idx) => {
        markdown += `## ${idx + 1}. ${section.title}\n\n`;
        markdown += `${section.content}\n\n`;
        markdown += `---\n\n`;
      });

      // References
      markdown += `## References\n\n`;
      report.citations.forEach((citation, idx) => {
        markdown += `[${idx + 1}] ${this.formatCitationAPA(citation)}\n\n`;
      });

      await writeFile(markdownPath, markdown, 'utf-8');
      
      logger.success(`Google Docs-ready Markdown saved to: ${markdownPath}`);
      logger.info('📝 To upload to Google Docs:');
      logger.info('   1. Go to https://docs.google.com');
      logger.info('   2. Click File > Open > Upload');
      logger.info(`   3. Select: ${markdownPath}`);
      
      return markdownPath;

    } catch (error) {
      logger.error(`Failed to generate Google Docs export: ${error}`);
      return null;
    }
  }

  /**
   * Render a section in Markdown (with section numbering)
   */
  private renderSection(section: any, level: number, citations: Citation[], sectionNumber?: number): string {
    const numberPrefix = sectionNumber ? `${sectionNumber}. ` : '';
    let markdown = `${'#'.repeat(level)} ${numberPrefix}${section.title}\n\n`;
    markdown += `${section.content}\n\n`;

    // Add inline citations at the end of section
    if (section.citations && section.citations.length > 0) {
      const citationNumbers = section.citations.map((citId: string) => {
        const idx = citations.findIndex(c => c.id === citId);
        return idx >= 0 ? idx + 1 : '?';
      });
      markdown += `*[References: ${citationNumbers.join(', ')}]*\n\n`;
    }

    // Render subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((subsection: any, idx: number) => {
        const subNumber = String.fromCharCode(97 + idx); // a, b, c, etc.
        markdown += `${'#'.repeat(level + 1)} ${subNumber}. ${subsection.title}\n\n`;
        markdown += `${subsection.content}\n\n`;
        
        if (subsection.citations && subsection.citations.length > 0) {
          const subCitationNumbers = subsection.citations.map((citId: string) => {
            const citIdx = citations.findIndex(c => c.id === citId);
            return citIdx >= 0 ? citIdx + 1 : '?';
          });
          markdown += `*[References: ${subCitationNumbers.join(', ')}]*\n\n`;
        }
      });
    }

    return markdown;
  }

  /**
   * Render a section in PDF (with section numbering)
   */
  private renderPDFSection(doc: any, section: any, fontSize: number, sectionNumber?: number): void {
    if (doc.y > 700) {
      doc.addPage();
    }

    const numberPrefix = sectionNumber ? `${sectionNumber}. ` : '';
    // Clean markdown formatting from title
    const cleanTitle = this.cleanMarkdownForPDF(section.title);
    doc.fontSize(fontSize).font('Helvetica-Bold').text(`${numberPrefix}${cleanTitle}`);
    doc.moveDown(0.5);
    
    // Clean markdown formatting from content
    const cleanContent = this.cleanMarkdownForPDF(section.content);
    doc.fontSize(11).font('Helvetica').text(cleanContent, { align: 'justify' });
    doc.moveDown();

    // Render subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((subsection: any, idx: number) => {
        if (doc.y > 700) {
          doc.addPage();
        }
        const subNumber = String.fromCharCode(97 + idx);
        const cleanSubTitle = this.cleanMarkdownForPDF(subsection.title);
        doc.fontSize(Math.max(fontSize - 2, 12)).font('Helvetica-Bold').text(`${subNumber}. ${cleanSubTitle}`);
        doc.moveDown(0.5);
        const cleanSubContent = this.cleanMarkdownForPDF(subsection.content);
        doc.fontSize(11).font('Helvetica').text(cleanSubContent, { align: 'justify' });
        doc.moveDown();
      });
    }
  }

  /**
   * Format a citation in APA style
   */
  private formatCitationAPA(citation: Citation): string {
    let formatted = '';
    
    // Author (Year). Title. URL. Accessed: Date.
    if (citation.author) {
      formatted += `${citation.author}`;
      if (citation.publishDate) {
        const year = new Date(citation.publishDate).getFullYear();
        formatted += ` (${year})`;
      }
      formatted += `. `;
    } else if (citation.publishDate) {
      const year = new Date(citation.publishDate).getFullYear();
      formatted += `(${year}). `;
    }
    
    formatted += `${citation.title}. `;
    formatted += `Retrieved from ${citation.url}. `;
    formatted += `Accessed: ${citation.accessDate}.`;
    
    return formatted;
  }

  /**
   * Render table in Markdown
   */
  private renderTable(data: any): string {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return '*No data available*\n\n';
    }

    const headers = Object.keys(data[0]);
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    data.forEach((row: any) => {
      table += '| ' + headers.map(h => row[h] || '').join(' | ') + ' |\n';
    });

    return table + '\n';
  }

  /**
   * Create URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Clean markdown formatting for PDF rendering
   */
  private cleanMarkdownForPDF(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    // Remove markdown headers (###, ##, # at start of line or anywhere)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    cleaned = cleaned.replace(/\s#{1,6}\s+/g, ' ');
    
    // Convert markdown bold **text** or __text__ to plain text (PDFKit handles font weight)
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/__(.+?)__/g, '$1');
    
    // Convert markdown italic *text* or _text_ to plain text (but preserve citation markers)
    // First preserve citation-style italic: *[References: ...]*
    cleaned = cleaned.replace(/\*\[References:([^\]]+)\]\*/g, '[References:$1]');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/_(.+?)_/g, '$1');
    
    // Remove markdown links but keep link text: [text](url) -> text
    // But preserve citation numbers [1], [2], etc.
    cleaned = cleaned.replace(/\[([^\]]+)\]\(http[^\)]+\)/g, '$1');
    
    // Remove markdown code blocks ``` and inline code `
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    
    // Remove horizontal rules (---, ***, ___)
    cleaned = cleaned.replace(/^[\-\*_]{3,}$/gm, '');
    cleaned = cleaned.replace(/^\s*[\-\*_]{3,}\s*$/gm, '');
    
    // Clean up list markers (-, *, +, 1.) but make them proper bullets
    cleaned = cleaned.replace(/^\s*[\-\*\+]\s+/gm, '• ');
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');
    
    // Remove blockquote markers (>)
    cleaned = cleaned.replace(/^>\s+/gm, '');
    
    // Remove any remaining markdown artifacts
    cleaned = cleaned.replace(/^---+$/gm, '');
    cleaned = cleaned.replace(/^\*\*\*/gm, '');
    
    // Clean up multiple newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }
}
