import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType,BorderStyle } from 'docx';
import { parse } from 'node-html-parser';

// Helper function to convert HTML nodes to docx elements
const htmlToDocxElements = (htmlNode) => {
    const elements = [];

    if (htmlNode.nodeType === 3) { // Text node
        if (htmlNode.text.trim()) {
            elements.push(new TextRun(htmlNode.text));
        }
        return elements;
    }

    if (htmlNode.nodeType !== 1) { // Not an element node
        return elements;
    }

    let children = [];
    if (htmlNode.childNodes.length > 0) {
        children = htmlNode.childNodes.flatMap(child => htmlToDocxElements(child));
    }

    switch (htmlNode.tagName.toLowerCase()) {
        case 'h2':
            elements.push(new Paragraph({ children, heading: HeadingLevel.HEADING_2 }));
            break;
        case 'h3':
            elements.push(new Paragraph({ children, heading: HeadingLevel.HEADING_3 }));
            break;
        case 'p':
            if (children.length > 0) {
                 elements.push(new Paragraph({ children }));
            }
            break;
        case 'ul':
        case 'ol':
            children.forEach(child => {
                if (child instanceof Paragraph) { // list items are parsed as paragraphs
                    child.properties.bullet = { level: 0 };
                    elements.push(child);
                }
            });
            break;
        case 'li': // `li` content is handled inside `ul`/`ol`
             if (children.length > 0) {
                elements.push(new Paragraph({ children, bullet: { level: 0 } }));
            }
            break;
         case 'hr':
            elements.push(new Paragraph({
                thematicBreak: true,
            }));
            break;
        case 'table':
            const rows = [];
            const tableNode = htmlNode;
            const trs = tableNode.querySelectorAll('tr');

            trs.forEach(tr => {
                const cells = [];
                const ths = tr.querySelectorAll('th');
                const tds = tr.querySelectorAll('td');

                ths.forEach(th => {
                    const cellContent = th.childNodes.flatMap(child => htmlToDocxElements(child));
                    cells.push(new TableCell({
                        children: [new Paragraph({ children: cellContent, style: "strong" })],
                        shading: { fill: "auto", val: "clear", color: "auto" },
                    }));
                });

                tds.forEach(td => {
                     const cellContent = td.childNodes.flatMap(child => htmlToDocxElements(child));
                     cells.push(new TableCell({ children: cellContent.length > 0 ? [new Paragraph({children: cellContent})] : [new Paragraph('')] }));
                });

                rows.push(new TableRow({ children: cells }));
            });

            if (rows.length > 0) {
                elements.push(new Table({
                    rows: rows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "dddddd" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    },
                }));
            }
            break;

        default:
            // For other tags like <div>, <span>, <strong>, just process their children
            return children;
    }

    return elements;
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
                paragraphStyles: [
                    {
                        id: "strong",
                        name: "Strong",
                        basedOn: "Normal",
                        next: "Normal",
                        run: {
                            bold: true,
                        },
                    },
                ],
            },
            sections: [{
                children: docxElements,
            }],
        });

        const docxBuffer = await Packer.toBuffer(doc);
        const safeFileName = fileName.replace(/[^a-z0-9_.-]/gi, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFileName}.docx`);

        return res.send(Buffer.from(docxBuffer));

    } catch (error) {
        console.error('Error generating DOCX:', error);
        return res.status(500).json({ error: 'Failed to generate DOCX file.' });
    }
}