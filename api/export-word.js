import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle } from 'docx';
import { parse } from 'node-html-parser';

// Helper function to convert HTML nodes to docx elements
const htmlToDocxElements = (htmlNode) => {
    if (htmlNode.nodeType === 3) { // Text node
        // Only return a TextRun if the text is not just whitespace
        return htmlNode.text.trim() ? [new TextRun(htmlNode.text)] : [];
    }

    if (htmlNode.nodeType !== 1) { // Not an element node
        return [];
    }

    const children = htmlNode.childNodes.flatMap(child => htmlToDocxElements(child));

    switch (htmlNode.tagName.toLowerCase()) {
        case 'h2':
            return [new Paragraph({ children, heading: HeadingLevel.HEADING_2 })];
        case 'h3':
            return [new Paragraph({ children, heading: HeadingLevel.HEADING_3 })];
        case 'p':
            // Return a paragraph only if it has meaningful content
            return children.length > 0 ? [new Paragraph({ children })] : [];
        case 'ul':
        case 'ol':
            // The children are already paragraphs with bullet points from the 'li' case
            return children;
        case 'li':
            // Create a paragraph with a bullet point for the list item content
            return children.length > 0 ? [new Paragraph({ children, bullet: { level: 0 } })] : [];
        case 'hr':
            return [new Paragraph({ thematicBreak: true })];
        case 'table':
            const rows = htmlNode.querySelectorAll('tr').map(tr => {
                const cells = tr.querySelectorAll('th, td').map(tc => {
                    const cellContent = tc.childNodes.flatMap(child => htmlToDocxElements(child));
                    const isHeader = tc.tagName.toLowerCase() === 'th';

                    // Ensure there's at least one paragraph in the cell, even if empty
                    const paragraphs = cellContent.length > 0 ? cellContent : [new Paragraph('')];

                    return new TableCell({
                        children: paragraphs.map(p => {
                            if (p instanceof Paragraph && isHeader) {
                                p.properties.style = "strong";
                            }
                            return p;
                        }),
                    });
                });
                return new TableRow({ children: cells });
            });

            return rows.length > 0 ? [new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                },
            })] : [];
        default:
            // For other tags (div, span, strong, etc.), just process their children
            return children;
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { htmlContent, fileName = 'briefing' } = req.body;

    if (!htmlContent) {
        return res.status(400).json({ error: 'htmlContent is required' });
    }

    try {
        const root = parse(htmlContent);
        const docxElements = root.childNodes.flatMap(node => htmlToDocxElements(node));

        const doc = new Document({
            styles: {
                paragraphStyles: [{
                    id: "strong",
                    name: "Strong",
                    basedOn: "Normal",
                    next: "Normal",
                    run: { bold: true },
                }],
            },
            sections: [{
                children: docxElements,
            }],
        });

        const docxBuffer = await Packer.toBuffer(doc);
        const safeFileName = fileName.replace(/[^a-z0-9_.-]/gi, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFileName}.docx`);

        // CRITICAL FIX: Do NOT re-wrap the buffer. Packer.toBuffer already returns a Buffer.
        return res.send(docxBuffer);

    } catch (error) {
        console.error('Error generating DOCX:', error);
        return res.status(500).json({ error: 'Failed to generate DOCX file.' });
    }
}