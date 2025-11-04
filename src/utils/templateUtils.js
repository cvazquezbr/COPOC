export const defaultBlockOrder = [
    'Título da Missão',
    'Saudação',
    'Premiação',
    'Entregas',
    'Mensagem Principal',
    'CTA',
    'DOs',
    "DON'Ts",
    'Hashtags',
    'Inspirações',
    'Próximos Passos'
];

export const parseBlockOrderFromRules = (rules) => {
    if (!rules) return defaultBlockOrder;

    const match = rules.match(/(?:EXATAMENTE nesta ordem:)([\s\S]*?)(?=R\d+\.|\s*$)/i);
    if (!match || !match[1]) {
        return defaultBlockOrder;
    }

    const blockListText = match[1];
    const blockTitles = blockListText
        .split('\n')
        .map(line => line.replace(/^-|\*|^\d+\.\s*/, '').trim())
        .filter(line => line);

    return blockTitles.length > 0 ? blockTitles : defaultBlockOrder;
};

export const htmlToSections = (html) => {
    const sections = {};
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const missionTitleElement = doc.querySelector('h2');
    if (missionTitleElement) {
        sections['Título da Missão'] = missionTitleElement.innerHTML;
    }

    const otherSectionElements = doc.querySelectorAll('h3');
    otherSectionElements.forEach(h3 => {
        const title = h3.textContent.trim();
        let content = '';
        let nextElement = h3.nextSibling;
        while (nextElement && nextElement.nodeName !== 'H3' && nextElement.nodeName !== 'TABLE') {
            content += nextElement.outerHTML || nextElement.data || '';
            nextElement = nextElement.nextSibling;
        }
        sections[title] = content.trim();
    });

    const table = doc.querySelector('table');
    if (table) {
        const dosList = [];
        const dontsList = [];

        const dosItems = table.querySelectorAll('tbody tr td:first-child ul li');
        dosItems.forEach(li => {
            dosList.push(`<p>${li.textContent.replace('→ ', '').trim()}</p>`);
        });

        const dontsItems = table.querySelectorAll('tbody tr td:last-child ul li');
        dontsItems.forEach(li => {
            dontsList.push(`<p>${li.textContent.replace('→ ', '').trim()}</p>`);
        });

        if (dosList.length > 0) {
            sections['DOs'] = dosList.join('');
        }
        if (dontsList.length > 0) {
            sections["DON'Ts"] = dontsList.join('');
        }
    }
    return sections;
};