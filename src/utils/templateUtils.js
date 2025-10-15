export const defaultBlockOrder = [
    'Título da Missão',
    'Saudação',
    'Entregas',
    'Mensagem Principal',
    'CTA',
    'DOs',
    "DON'Ts",
    'Hashtags',
    'Inspirações',
    'Premiação',
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