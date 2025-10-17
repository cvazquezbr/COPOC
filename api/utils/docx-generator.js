import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle, AlignmentType, UnderlineType, PageBreak } from 'docx';
import { parse } from 'node-html-parser';

const generateDocx = async (htmlContent) => {
    if (!htmlContent) {
        throw new Error('htmlContent is required');
    }

    const root = parse(htmlContent);

    const docxElements = convertNodesToDocxObjects(root.childNodes);

    const doc = new Document({
        sections: [{
            children: docxElements,
        }],
    });

    return Packer.toBuffer(doc);
};

function convertNodesToDocxObjects(nodes) {
    let elements = [];
    for (const node of nodes) {
        if (node.nodeType === 1) { // ELEMENT_NODE
            elements.push(...convertElementToDocx(node));
        }
    }
    return elements;
}

function convertElementToDocx(element) {
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            const level = `HEADING_${tagName.charAt(1)}`;
            return [new Paragraph({
                children: processInlines(element.childNodes),
                heading: HeadingLevel[level],
            })];
        case 'p':
        case 'div':
            return [new Paragraph({ children: processInlines(element.childNodes) })];
        case 'ul':
        case 'ol':
            let listItems = [];
            for (const child of element.childNodes) {
                if (child.tagName && child.tagName.toLowerCase() === 'li') {
                    listItems.push(
                        new Paragraph({
                            children: processInlines(child.childNodes),
                            bullet: { level: 0 },
                        })
                    );
                }
            }
            return listItems;
        case 'br':
            return [new Paragraph({ children: [new TextRun({ text: '', break: 1 })] })];
        case 'hr':
            return [new Paragraph({ thematicBreak: true })];
        case 'table':
            return [createTable(element)];
        default:
             // For unhandled block tags, just process their children as paragraphs
            const children = processInlines(element.childNodes);
            if (children.length > 0) {
                return [new Paragraph({ children })];
            }
            return [];
    }
}

function processInlines(nodes, style = {}) {
    let inlines = [];
    for (const node of nodes) {
        if (node.nodeType === 3) { // TEXT_NODE
            if(node.text.trim()){
                 inlines.push(new TextRun({ text: node.text, ...style }));
            }
        } else if (node.nodeType === 1) { // ELEMENT_NODE
            let newStyle = { ...style };
            const tagName = node.tagName.toLowerCase();
            switch (tagName) {
                case 'strong':
                case 'b':
                    newStyle.bold = true;
                    break;
                case 'em':
                case 'i':
                    newStyle.italics = true;
                    break;
                case 'u':
                    newStyle.underline = { type: UnderlineType.SINGLE };
                    break;
                case 'br':
                    inlines.push(new TextRun({ text: '', break: 1 }));
                    continue;
            }
            inlines.push(...processInlines(node.childNodes, newStyle));
        }
    }
    return inlines;
}

function createTable(tableNode) {
    const rows = [];
    for (const rowNode of tableNode.querySelectorAll('tr')) {
        const cells = [];
        for (const cellNode of rowNode.querySelectorAll('th, td')) {
            let cellChildren = convertNodesToDocxObjects(cellNode.childNodes);
            // A TableCell must contain at least one Paragraph.
            if (cellChildren.length === 0 || !(cellChildren[0] instanceof Paragraph)) {
                cellChildren = [new Paragraph({ children: processInlines(cellNode.childNodes) })];
            }
            cells.push(new TableCell({
                children: cellChildren,
                 borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
                },
            }));
        }
        rows.push(new TableRow({ children: cells }));
    }
    return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
    });
}

export { generateDocx };