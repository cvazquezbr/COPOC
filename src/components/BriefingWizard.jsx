import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Box, Button, Typography, Stepper, Step, StepLabel, Dialog, DialogTitle, DialogContent, Grid, CircularProgress, TextField, useMediaQuery, Backdrop, DialogActions, Paper, Card, CardContent, CardActions, Alert, Drawer, Tooltip, IconButton, Tabs, Tab
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack, ArrowForward, UploadFile, Edit, Check, Notes as NotesIcon, Fullscreen, FullscreenExit, Download, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'sonner';

import TextEditor from './TextEditor';
import HtmlDisplay from './HtmlDisplay';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { parseWordDocument, parsePdfDocument } from '../utils/fileImport';
import geminiAPI from '../utils/geminiAPI';
import { useUserAuth } from '../context/UserAuthContext';

const sectionsToHtml = (sections, blockOrder = []) => {
    let htmlContent = '';
    const processedTitles = new Set();

    const parseList = (html) => {
        if (!html) return [];
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = Array.from(doc.body.querySelectorAll('li, p'));
        return items.map(item => item.textContent.trim()).filter(text => text);
    };

    const sectionsMap = new Map(Object.entries(sections).map(([k, v]) => [k.toLowerCase(), v]));
    const orderedTitles = blockOrder.length > 0 ? blockOrder : Object.keys(sections);

    orderedTitles.forEach((title, index) => {
        const lowerCaseTitle = title.toLowerCase();
        if (processedTitles.has(lowerCaseTitle)) {
            return;
        }

        const content = sectionsMap.get(lowerCaseTitle) || '';
        let sectionHtml = '';

        switch (lowerCaseTitle) {
            case 'título da missão': {
                const cleanedTitle = content.replace(/^<p>|<\/p>$/g, '');
                sectionHtml = `<h2>${cleanedTitle}</h2>\n`;
                break;
            }
            case 'dos': {
                const dosContent = sectionsMap.get('dos') || '';
                const dontsContent = sectionsMap.get("don'ts") || '';
                const dosList = parseList(dosContent);
                const dontsList = parseList(dontsContent);

                if (dosList.length > 0 || dontsList.length > 0) {
                    sectionHtml = `
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; table-layout: fixed;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 1.2em;">DO'S</th>
                                    <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 1.2em;">DON'TS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="vertical-align: top; padding: 8px; width: 50%;">
                                        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
                                            ${dosList.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
                                        </ul>
                                    </td>
                                    <td style="vertical-align: top; padding: 8px; width: 50%;">
                                        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
                                            ${dontsList.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    `;
                }
                processedTitles.add('dos');
                processedTitles.add("don'ts");
                break;
            }
            case "don'ts":
                return; // Handled by 'dos'
            default:
                if (content && content.trim() !== '') {
                    sectionHtml = `<h3>${title}</h3>\n${content}\n\n`;
                }
                break;
        }

        if (sectionHtml) {
            htmlContent += sectionHtml;
            if (index < orderedTitles.length - 1) {
                htmlContent += '<hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;" />\n';
            }
        }
        processedTitles.add(lowerCaseTitle);
    });

    return htmlContent;
};

const htmlToSections = (html) => {
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

const extractBlockOrder = (rules, defaultOrder) => {
    const pattern = /EXATAMENTE nesta ordem:([\s\S]*?)(?=R\d+\.|\s*$)/i;
    const match = rules.match(pattern);

    if (match && match[1]) {
        const blockList = match[1]
            .split('\n')
            .map(item => item.trim().replace(/^(-|\*|\d+\.)\s*/, ''))
            .filter(item => item && !item.startsWith('//'));

        if (blockList.length > 0) {
            return blockList;
        }
    }
    return defaultOrder;
};

const isEditorEmpty = (htmlString) => {
    if (!htmlString) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    return tempDiv.textContent.trim() === '' && !tempDiv.querySelector('img');
};

const BriefingWizard = ({ open, onClose, onSave, onDelete, briefingData, onBriefingDataChange, isNewBriefing, creationMode = 'text' }) => {
    const { user } = useUserAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const steps = useMemo(() => {
        if (creationMode === 'sections') {
            return ['Preencher Seções', 'Revisão', 'Finalização'];
        }
        return ['Edição', 'Revisão', 'Finalização'];
    }, [creationMode]);

    const [activeStep, setActiveStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isNotesDrawerOpen, setNotesDrawerOpen] = useState(false);
    const [focusModeTarget, setFocusModeTarget] = useState(null);
    const [activeSuggestion, setActiveSuggestion] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [revisionError, setRevisionError] = useState(null);
    const [isRevised, setIsRevised] = useState(false);

    const formattedBaseText = useMemo(() => {
        if (!briefingData.baseText) return '';
        const isHtml = /<[a-z][\s\S]*>/i.test(briefingData.baseText);
        if (isHtml) {
            return briefingData.baseText;
        }
        let text = briefingData.baseText;
        if (briefingData.template && briefingData.template.blocks) {
            const blockTitles = briefingData.template.blocks.map(b => b.title);
            blockTitles.forEach(title => {
                const escapedTitle = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`^.*${escapedTitle}.*$`, 'gim');
                text = text.replace(regex, `<h6>${title}</h6>`);
            });
        }
        return text.replace(/\n/g, '<br />').replace(/(<h6>.*<\/h6>)<br \/>/gi, '$1').replace(/(<br \s*\/?>\s*){2,}/g, '<p></p>');
    }, [briefingData.baseText, briefingData.template]);

    const wordInputRef = useRef(null);
    const pdfInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setActiveStep(0);
            setIsRevised(false);
            setRevisionError(null);
        }
    }, [open]);

    useEffect(() => {
        if (activeStep === steps.length - 1) {
            setLoadingMessage('Gerando texto final...');
            setIsLoading(true);
            setTimeout(() => {
                const finalHtml = sectionsToHtml(briefingData.sections, briefingData.template?.blocks?.map(b => b.title) || []);
                onBriefingDataChange(prev => ({ ...prev, finalText: finalHtml }));
                setIsLoading(false);
            }, 100);
        }
    }, [activeStep, steps.length, briefingData.sections, briefingData.template, onBriefingDataChange]);


    const handleNext = async () => {
        const currentStepLabel = steps[activeStep];
        const nextStep = activeStep + 1;

        if (currentStepLabel === 'Preencher Seções') {
            const baseTextFromSections = sectionsToHtml(briefingData.sections, briefingData.template?.blocks?.map(b => b.title) || []);
            onBriefingDataChange(prev => ({ ...prev, baseText: baseTextFromSections }));
        } else if (currentStepLabel === 'Revisão') {
            const updatedSections = htmlToSections(briefingData.revisedText);
            onBriefingDataChange(prev => ({
                ...prev,
                sections: updatedSections,
            }));
        }
        setActiveStep(nextStep);
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
    };

    const handleBriefingDataChange = (field, value) => {
        onBriefingDataChange(prev => ({ ...prev, [field]: value }));
    };

    const handleSectionChange = (title, content) => {
        onBriefingDataChange(prev => ({
            ...prev,
            sections: { ...prev.sections, [title]: content }
        }));
    };

    const handleRevise = async () => {
        if (isEditorEmpty(briefingData.baseText)) {
            toast.error('O texto base é obrigatório.');
            return;
        }
        if (!briefingData.template) {
            toast.error('O modelo de referência é obrigatório.');
            return;
        }

        const apiKey = user?.gemini_api_key;
        if (!apiKey) {
            toast.error('Chave de API do Gemini não configurada. Por favor, verifique suas configurações.');
            return;
        }
        geminiAPI.initialize(apiKey);

        setIsLoading(true);
        setLoadingMessage('Iniciando revisão com IA...');
        setRevisionError(null);
        setIsRevised(false);

        try {
            setLoadingMessage('Analisando e reestruturando o briefing...');
            const result = await geminiAPI.reviseBriefing(briefingData.baseText, briefingData.template, user.gemini_model);

            if (!result || typeof result.sections !== 'object' || result.sections === null) {
                throw new Error("A resposta da IA não continha a estrutura de seções esperada.");
            }

            const aiSections = result.sections;
            const blockOrder = extractBlockOrder(briefingData.template.generalRules, briefingData.template.blocks.map(b => b.title));
            const finalSections = {};
            const aiSectionsMap = new Map(Object.entries(aiSections).map(([k, v]) => [k.toLowerCase(), v]));

            blockOrder.forEach(title => {
                const lowerCaseTitle = title.toLowerCase();
                if (aiSectionsMap.has(lowerCaseTitle) && aiSectionsMap.get(lowerCaseTitle).trim() !== '') {
                    finalSections[title] = aiSectionsMap.get(lowerCaseTitle);
                } else {
                    finalSections[title] = "<p>A revisão não encontrou conteúdo para esta seção.</p>";
                }
            });

            const revisedText = sectionsToHtml(finalSections);
            const formattedNotes = Array.isArray(result.revisionNotes) ? result.revisionNotes.map(note => `<p>- ${note}</p>`).join('') : result.revisionNotes || '';

            onBriefingDataChange(prev => ({
                ...prev,
                revisedText: revisedText,
                revisionNotes: formattedNotes,
                sections: finalSections,
            }));
            toast.success('Briefing revisado com sucesso!');
            setIsRevised(true);
        } catch (error) {
            console.error("Erro detalhado na revisão com IA:", error);
            let userErrorMessage = `Erro na revisão com IA: ${error.message}. Verifique o console para mais detalhes.`;
            setRevisionError(userErrorMessage);
            toast.error(userErrorMessage);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleFileImport = async (event, parser, contentSetter) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoadingMessage('Importando arquivo...');
        setIsLoading(true);

        try {
            const content = await parser(file);
            contentSetter(content);
            toast.success(`${file.name} importado com sucesso!`);
        } catch (error) {
            toast.error(error.toString());
        } finally {
            setIsLoading(false);
            event.target.value = null;
        }
    };

    const handleGenerateSuggestion = async (title) => {
        setLoadingMessage(`Gerando sugestão para "${title}"...`);
        setIsLoading(true);
        try {
            const context = {
                dos: briefingData.sections['DOs'] || '',
                donts: briefingData.sections["DON'Ts"] || '',
                mainMessage: briefingData.sections['Mensagem Principal'] || '',
                campaignInfo: briefingData.sections['Sobre a campanha'] || '',
            };
            const suggestion = await geminiAPI.generateBlockSuggestion(title, context);
            setEditingContent(suggestion || '');
            setActiveSuggestion(title);
            if (!suggestion) {
                toast.info('A IA não conseguiu gerar uma sugestão. Tente editar manualmente.');
            }
        } catch (error) {
            toast.error(`Erro ao gerar sugestão: ${error.message}`);
            setEditingContent(`Falha ao gerar sugestão: ${error.message}`);
            setActiveSuggestion(title);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptSuggestion = () => {
        if (!activeSuggestion) return;
        handleSectionChange(activeSuggestion, editingContent);
        toast.success(`Bloco "${activeSuggestion}" atualizado!`);
        setActiveSuggestion(null);
        setEditingContent('');
    };

    const renderStep0_Edit = () => (
        <Grid container spacing={3} sx={{ height: '100%' }}>
            <Grid item xs={12} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Cole, digite ou importe o texto base do seu briefing. O modelo de briefing será carregado e usado na próxima etapa.
                        </Typography>
                    </Box>
                    <Tooltip title="Edição Focada">
                        <IconButton onClick={() => setFocusModeTarget('baseText')}>
                            <Fullscreen />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <TextEditor
                        value={formattedBaseText}
                        onChange={(val) => handleBriefingDataChange('baseText', val)}
                        html={true}
                        placeholder="Digite ou cole o conteúdo do briefing aqui..."
                    />
                </Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <input type="file" ref={wordInputRef} hidden accept=".docx" onChange={(e) => handleFileImport(e, parseWordDocument, (val) => handleBriefingDataChange('baseText', val))} />
                    <input type="file" ref={pdfInputRef} hidden accept=".pdf" onChange={(e) => handleFileImport(e, parsePdfDocument, (val) => handleBriefingDataChange('baseText', val))} />
                    <Button variant="outlined" onClick={(e) => { e.stopPropagation(); wordInputRef.current.click(); }} startIcon={<UploadFile />} disabled={isLoading}>Importar Word (.docx)</Button>
                    <Button variant="outlined" onClick={(e) => { e.stopPropagation(); pdfInputRef.current.click(); }} startIcon={<UploadFile />} disabled={isLoading}>Importar PDF</Button>
                </Box>
            </Grid>
        </Grid>
    );

    const renderStep0_Sections = () => {
        const blockOrder = briefingData.template?.blocks?.map(b => b.title) || [];
        const sortedSections = Object.entries(briefingData.sections).sort(([a], [b]) => {
            const indexA = blockOrder.indexOf(a);
            const indexB = blockOrder.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" gutterBottom>Completar Blocos</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Preencha as seções abaixo. Você pode usar a IA para gerar sugestões.
                </Typography>
                <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
                    <Grid item xs={12} md={5} sx={{ height: '100%', overflowY: 'auto', pr: 1 }}>
                        {sortedSections.map(([title, content]) => {
                            const isEmpty = isEditorEmpty(content);
                            return (
                                <Card key={title} variant="outlined" sx={{ mb: 2, borderColor: isEmpty ? 'warning.main' : 'divider' }}>
                                    <CardContent>
                                        <Typography variant="h6" component="div">{title}</Typography>
                                        {isEmpty ? (
                                            <Alert severity="warning" sx={{ mt: 1 }}>Este bloco está vazio.</Alert>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary" sx={{ maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }} dangerouslySetInnerHTML={{ __html: content }} />
                                        )}
                                    </CardContent>
                                    <CardActions>
                                        <Button size="small" startIcon={<Edit />} onClick={() => {
                                            setActiveSuggestion(title);
                                            setEditingContent(content || '<p></p>');
                                        }}>Editar</Button>
                                        {isEmpty && <Button size="small" onClick={() => handleGenerateSuggestion(title)}>Sugerir</Button>}
                                    </CardActions>
                                </Card>
                            );
                        })}
                    </Grid>
                    <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {activeSuggestion ? (
                            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" gutterBottom>{`Editando: "${activeSuggestion}"`}</Typography>
                                <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                    <TextEditor value={editingContent} onChange={setEditingContent} html={true} />
                                </Box>
                                <Button onClick={handleAcceptSuggestion} variant="contained" startIcon={<Check />} sx={{ mt: 2 }}>Confirmar Texto</Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '2px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                <Typography color="text.secondary">Selecione "Editar" ou "Sugerir" em um bloco à esquerda.</Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </Box>
        );
    }

    const renderStep1_Review = () => {
        if (revisionError) {
            return (
                <Alert severity="error" action={
                    <Button color="inherit" size="small" onClick={handleRevise} disabled={isLoading}>
                        Tentar Novamente
                    </Button>
                }>
                    {revisionError}
                </Alert>
            );
        }

        if (!isRevised) {
            return (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                    <Typography variant="h6" gutterBottom>Pronto para revisar com a IA?</Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        A IA irá analisar o conteúdo, reestruturá-lo conforme o modelo e fazer sugestões.
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleRevise}
                        disabled={isLoading}
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <Check />}
                    >
                        {isLoading ? loadingMessage : 'Revisar com IA'}
                    </Button>
                </Box>
            );
        }

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
                    <Grid item xs={12} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" gutterBottom mb={0}>
                                Briefing Revisado (Editável)
                            </Typography>
                            <Box>
                                <Tooltip title="Edição Focada">
                                    <IconButton onClick={() => setFocusModeTarget('revisedText')}>
                                        <Fullscreen />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Ver Notas da Revisão">
                                    <Button startIcon={<NotesIcon />} onClick={() => setNotesDrawerOpen(true)}>
                                        Ver Notas
                                    </Button>
                                </Tooltip>
                            </Box>
                        </Box>
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <TextEditor value={briefingData.revisedText} onChange={(val) => handleBriefingDataChange('revisedText', val)} html={true} />
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        );
    };

const FinalizationStep = ({ briefingData, onBriefingDataChange }) => {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const dosContent = briefingData.sections['DOs'] || '<p>Nenhum DO definido.</p>';
    const dontsContent = briefingData.sections["DON'Ts"] || "<p>Nenhum DON'T definido.</p>";

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Finalização</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Defina um nome para o seu briefing e revise o documento final. Para fazer ajustes, volte às etapas anteriores.
            </Typography>
            <TextField
                name="name"
                label="Nome do Briefing"
                fullWidth
                value={briefingData.name || ''}
                onChange={(e) => onBriefingDataChange('name', e.target.value)}
                required
                sx={{ mb: 2, flexShrink: 0 }}
            />
            <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Tabs value={tabIndex} onChange={handleTabChange} aria-label="abas de finalização">
                    <Tab label="Documento" />
                    <Tab label="DOs & DON'Ts" />
                </Tabs>
            </Box>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: tabIndex === 1 ? 2 : 0, minHeight: 0 }}>
                {tabIndex === 0 && (
                    <HtmlDisplay htmlContent={briefingData.finalText} />
                )}
                {tabIndex === 1 && (
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent>
                                    <Typography variant="h5" component="div" sx={{ mb: 1.5 }}>
                                        DOs
                                    </Typography>
                                    <HtmlDisplay htmlContent={dosContent} />
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent>
                                    <Typography variant="h5" component="div" sx={{ mb: 1.5 }}>
                                        DON'Ts
                                    </Typography>
                                    <HtmlDisplay htmlContent={dontsContent} />
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}
            </Box>
        </Box>
    );
};

    const renderContent = () => {
        const currentStepLabel = steps[activeStep];
        switch (currentStepLabel) {
            case 'Edição':
                return renderStep0_Edit();
            case 'Preencher Seções':
                return renderStep0_Sections();
            case 'Revisão':
                return renderStep1_Review();
            case 'Finalização':
                return <FinalizationStep briefingData={briefingData} onBriefingDataChange={handleBriefingDataChange} />;
            default:
                return null;
        }
    }

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" fullScreen={isMobile} PaperProps={{ sx: { height: isMobile ? '100%' : '90vh' } }}>
                <DialogTitle>
                    {isNewBriefing ? `Novo Briefing (${creationMode === 'text' ? 'Texto' : 'Seções'})` : `Editando: ${briefingData?.name || ''}`}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflowY: 'hidden', p: { xs: 1, sm: 2, md: 3 } }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 2, flexShrink: 0 }}>
                        {steps.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
                    </Stepper>
                    <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
                        {renderContent()}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: { xs: 1, sm: 2 }}}>
                    {onDelete && (
                        <Tooltip title="Excluir Briefing">
                            <IconButton onClick={onDelete} color="error" sx={{ mr: 'auto' }}>
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Button onClick={onClose}>Cancelar</Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button disabled={activeStep === 0} onClick={handleBack}>Anterior</Button>
                    {activeStep === steps.length - 1 ? (
                        <Button onClick={onSave} variant="contained" color="primary">Salvar Briefing</Button>
                    ) : (
                        <Button
                            onClick={handleNext}
                            endIcon={<ArrowForward />}
                            disabled={isLoading}
                        >
                            Próximo
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
            <Drawer
                anchor="right"
                open={isNotesDrawerOpen}
                onClose={() => setNotesDrawerOpen(false)}
                sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
                PaperProps={{
                    sx: {
                        width: isMobile ? '90%' : 450,
                        p: 2,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <Typography variant="h6" gutterBottom>Notas da Revisão (Editável)</Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'grey.50' }}>
                    <TextEditor value={briefingData.revisionNotes} onChange={(val) => handleBriefingDataChange('revisionNotes', val)} html={true} />
                </Box>
                <Button onClick={() => setNotesDrawerOpen(false)} sx={{ mt: 2 }}>
                    Fechar
                </Button>
            </Drawer>
            <Dialog open={Boolean(focusModeTarget)} onClose={() => setFocusModeTarget(null)} fullScreen>
                <DialogTitle>
                    Edição Focada
                    <IconButton
                        aria-label="close"
                        onClick={() => setFocusModeTarget(null)}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                            color: (theme) => theme.palette.grey[500],
                        }}
                    >
                        <FullscreenExit />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, m: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {focusModeTarget && (
                        <TextEditor
                            value={briefingData[focusModeTarget]}
                            onChange={(val) => handleBriefingDataChange(focusModeTarget, val)}
                            html={true}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

export default BriefingWizard;