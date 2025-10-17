import { generateDocx } from './utils/docx-generator.js';
import { query } from './db.js';
import { withAuth } from './middleware/auth.js';

const handleBriefingExport = async (req) => {
    const { htmlContent, fileName = 'briefing' } = req.body;
    if (!htmlContent) {
        throw new Error('htmlContent is required for briefing export.');
    }
    const docxBuffer = await generateDocx(htmlContent);
    return { docxBuffer, fileName };
};

const handleTemplateExport = async (req) => {
    const { templateId } = req.body;
    const { userId } = req;

    if (!templateId) {
        throw new Error('templateId is required for template export.');
    }

    const { rows } = await query(
        'SELECT name, blocks, general_rules FROM briefing_templates WHERE id = $1 AND user_id = $2',
        [templateId, userId]
    );

    if (rows.length === 0) {
        const err = new Error('Template not found or access denied.');
        err.statusCode = 404;
        throw err;
    }

    const template = rows[0];
    let htmlContent = `<h1>${template.name}</h1>`;
    if (template.general_rules) {
        htmlContent += `<h2>Regras Gerais</h2>${template.general_rules}`;
    }
    if (template.blocks && template.blocks.length > 0) {
        htmlContent += `<h2>Blocos do Briefing</h2>`;
        template.blocks.forEach(block => {
            htmlContent += `<h3>${block.title}</h3>`;
            if (block.description) {
                htmlContent += `<p><em>${block.description}</em></p>`;
            }
            if (block.initial_content) {
                htmlContent += `<div>${block.initial_content}</div>`;
            }
            htmlContent += '<hr />';
        });
    }

    const docxBuffer = await generateDocx(htmlContent);
    return { docxBuffer, fileName: template.name };
};


const handler = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { exportType } = req.body;

    try {
        let result;
        if (exportType === 'briefing') {
            result = await handleBriefingExport(req);
        } else if (exportType === 'template') {
            result = await handleTemplateExport(req);
        } else {
            return res.status(400).json({ error: 'Invalid exportType specified.' });
        }

        const { docxBuffer, fileName } = result;
        const safeFileName = (fileName || 'export').replace(/[^a-z0-9_.-]/gi, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFileName}.docx`);
        return res.send(docxBuffer);

    } catch (error) {
        console.error(`Error generating DOCX for type ${exportType}:`, error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: `Failed to generate DOCX file. ${error.message}` });
    }
};

export default withAuth(handler);