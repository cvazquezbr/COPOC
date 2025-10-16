import htmlToDocx from 'html-to-docx';

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
        const docxBuffer = await htmlToDocx(htmlContent, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            header: true,
        });

        const safeFileName = fileName.replace(/[^a-z0-9_.-]/gi, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFileName}.docx`);

        return res.send(docxBuffer);

    } catch (error) {
        console.error('Error generating DOCX:', error);
        return res.status(500).json({ error: 'Failed to generate DOCX file.' });
    }
}