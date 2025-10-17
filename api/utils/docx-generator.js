import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle, AlignmentType, UnderlineType } from 'docx';
import { parse } from 'node-html-parser';

const convertToInches = (value) => {
    if (typeof value === 'string' && value.endsWith('px')) {
        const pixels = parseInt(value, 10);
        return pixels / 96; // Assume 96 DPI
    }
    return 1; // Default size
};

const mapTextAlign = (align) => {
    switch (align) {
        case 'center':
            return AlignmentType.CENTER;
        case 'right':
            return AlignmentType.RIGHT;
        case 'justify':
            return AlignmentType.JUSTIFY;
        default:
            return AlignmentType.LEFT;
    }
};

const processNode = (node) => {
    if (node.nodeType === 3) { // Text node
        return new TextRun(node.text);
    }

    if (node.nodeType !== 1) { // Not an element node
        return null;
    }

    const children = node.childNodes.map(processNode).filter(Boolean);

    const style = {};
    if (node.getAttribute('style')) {
        node.getAttribute('style').split(';').forEach(rule => {
            const [key, value] = rule.split(':').map(s => s.trim());
            if (key && value) style[key] = value;
        });
    }

    let textRunOptions = {};
    if (style['font-weight'] === 'bold' || node.tagName === 'B' || node.tagName === 'STRONG') {
        textRunOptions.bold = true;
    }
    if (style['font-style'] === 'italic' || node.tagName === 'I' || node.tagName === 'EM') {
        textRunOptions.italics = true;
    }
    if (style['text-decoration'] === 'underline' || node.tagName === 'U') {
        textRunOptions.underline = { type: UnderlineType.SINGLE };
    }
    if (style['color']) {
        textRunOptions.color = style['color'].replace('#', '');
    }
    if (style['font-size']) {
        textRunOptions.size = convertToInches(style['font-size']) * 24; // Convert inches to half-points
    }


    const applyOptions = (run) => {
        if (run instanceof TextRun) {
            run.options = { ...run.options, ...textRunOptions };
        } else if (run instanceof Paragraph) {
            run.root.forEach(p => {
                if (p instanceof TextRun) {
                    p.options = { ...p.options, ...textRunOptions };
                }
            });
        }
        return run;
    };

    const paragraphOptions = {};
    if (style['text-align']) {
        paragraphOptions.alignment = mapTextAlign(style['text-align']);
    }

    switch (node.tagName.toLowerCase()) {
        case 'h1': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_1, ...paragraphOptions });
        case 'h2': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_2, ...paragraphOptions });
        case 'h3': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_3, ...paragraphOptions });
        case 'h4': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_4, ...paragraphOptions });
        case 'h5': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_5, ...paragraphOptions });
        case 'h6': return new Paragraph({ children: children.map(applyOptions), heading: HeadingLevel.HEADING_6, ...paragraphOptions });
        case 'p': return new Paragraph({ children: children.map(applyOptions), ...paragraphOptions });
        case 'div': return new Paragraph({ children: children.map(applyOptions), ...paragraphOptions });
        case 'br': return new Paragraph(""); // Represents a line break
        case 'ul':
        case 'ol':
            return children.filter(c => c instanceof Paragraph);
        case 'li': {
            const paragraph = new Paragraph({ children: children.map(applyOptions), bullet: { level: 0 }, ...paragraphOptions });
            return paragraph;
        }
        case 'hr': return new Paragraph({ thematicBreak: true });
        case 'table':
            const rows = node.querySelectorAll('tr').map(tr => {
                const cells = tr.querySelectorAll('th, td').map(tc => {
                    const cellContent = tc.childNodes.flatMap(processNode).filter(Boolean);
                    const paragraphs = cellContent.length > 0 ? cellContent : [new Paragraph('')];
                    return new TableCell({
                        children: paragraphs,
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                        },
                    });
                });
                return new TableRow({ children: cells });
            });
            return new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
            });

        case 'b':
        case 'strong':
        case 'i':
        case 'em':
        case 'u':
        case 'span':
        case 'font':
            return children.map(applyOptions);

        default:
            return children;
    }
};

export const generateDocx = async (htmlContent) => {
    if (!htmlContent) {
        throw new Error('htmlContent is required');
    }

    const root = parse(htmlContent, {
        blockTextElements: {
            script: false,
            noscript: false,
            style: false,
        },
    });

    const docxElements = root.childNodes.flatMap(processNode).filter(Boolean);

    const doc = new Document({
        sections: [{
            children: docxElements,
        }],
    });

    return Packer.toBuffer(doc);
};