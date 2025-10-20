import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress, TextField, Paper, Accordion, AccordionSummary, AccordionDetails, IconButton, useTheme, useMediaQuery, Chip
} from '@mui/material';
import { Edit, Save, Download, ExpandMore as ExpandMoreIcon, Add, Delete } from '@mui/icons-material';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Packer } from 'docx';
import { saveAs } from 'file-saver';
import { Document, Paragraph, TextRun, HeadingLevel } from 'docx';
import { useDebounce } from 'use-debounce';

import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import TextEditor from '../components/TextEditor';
import LoadingDialog from '../components/LoadingDialog';
import SavingModal from '../components/SavingModal';
import { parseBlockOrderFromRules } from '../utils/templateUtils';

const highlightOrderRule = (text) => {
    if (!text) return null;

    const pattern = /(EXATAMENTE nesta ordem:)([\s\S]*?)(?=R\d+\.|\s*$)/i;
    const match = text.match(pattern);

    if (match && match[1] && match[2]) {
        const beforeText = text.substring(0, match.index);
        const afterText = text.substring(match.index + match[0].length);

        return (
            <>
                {beforeText}
                <span style={{ backgroundColor: 'yellow', fontWeight: 'bold' }}>{match[1]}</span>
                <span style={{ backgroundColor: 'lightgreen' }}>{match[2]}</span>
                {afterText}
            </>
        );
    }

    return text;
};

const BriefingTemplatePage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [template, setTemplate] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [editingBlock, setEditingBlock] = useState(null);
    const [focusModeTarget, setFocusModeTarget] = useState(null);
    const isInitialMount = useRef(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaveModalOpen, setSaveModalOpen] = useState(false);

    const [debouncedTemplate] = useDebounce(template, 2000);

    const handleManualSave = async () => {
        if (!template) return;
        setSaveModalOpen(true);
        try {
            const response = await fetch('/api/briefing-template', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_data: template }),
            });
            if (!response.ok) throw new Error('Falha ao salvar o modelo.');
            toast.success('Modelo salvo com sucesso!');
            setHasUnsavedChanges(false);
        } catch (error) {
            toast.error(`Erro ao salvar o modelo: ${error.message}`);
            setError(error.message);
        } finally {
            setSaveModalOpen(false);
        }
    };

    useEffect(() => {
        if (!isInitialMount.current) {
            setHasUnsavedChanges(true);
        }
    }, [template]);


    const syncBlocksWithRules = useCallback((currentTemplate) => {
        if (!currentTemplate) return null;
        const parsedTitles = parseBlockOrderFromRules(currentTemplate.generalRules);
        const existingBlocksMap = new Map(currentTemplate.blocks.map(b => [b.title.toLowerCase(), b]));

        const newBlocks = parsedTitles.map(title => {
            const lowerCaseTitle = title.toLowerCase();
            if (existingBlocksMap.has(lowerCaseTitle)) {
                const existingBlock = existingBlocksMap.get(lowerCaseTitle);
                return { ...existingBlock, title: title };
            }
            return {
                id: uuidv4(),
                title: title,
                content: '',
                rules: ''
            };
        });

        const sortedExistingTitles = currentTemplate.blocks.map(b => b.title).sort().join(',');
        const sortedNewTitles = newBlocks.map(b => b.title).sort().join(',');

        if (sortedExistingTitles !== sortedNewTitles) {
            return { ...currentTemplate, blocks: newBlocks };
        }
        return currentTemplate;
    }, []);

    useEffect(() => {
        const fetchTemplate = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/briefing-template');
                let templateData;
                if (!response.ok) {
                    if (response.status === 404) {
                        toast.info('Nenhum modelo salvo encontrado, usando o padrão.');
                        templateData = defaultBriefingTemplate;
                    } else {
                        throw new Error(`Failed to fetch template: ${response.statusText}`);
                    }
                } else {
                    const result = await response.json();
                    // O backend retorna um único objeto, não um array.
                    if (result && result.template_data) {
                        const rawData = result.template_data;
                        templateData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                        toast.info('Seu modelo de briefing foi carregado.');
                    } else {
                        templateData = defaultBriefingTemplate;
                        toast.info('Usando modelo de briefing padrão.');
                    }
                }
                // Perform the first sync right after loading the data.
                const syncedTemplate = syncBlocksWithRules(templateData);
                setTemplate(syncedTemplate);
            } catch (err) {
                toast.error(`Erro ao carregar seu modelo de briefing: ${err.message}`);
                setError(err.message);
                setTemplate(syncBlocksWithRules(defaultBriefingTemplate));
            } finally {
                setIsLoading(false);
                isInitialMount.current = false;
            }
        };

        fetchTemplate();
    }, [syncBlocksWithRules]);


    useEffect(() => {
        if (!isInitialMount.current && template) {
            setTemplate(currentTemplate => syncBlocksWithRules(currentTemplate));
        }
    }, [template?.generalRules, syncBlocksWithRules]);


    const handleTemplateChange = (field, value) => {
        setTemplate(prev => (prev ? { ...prev, [field]: value } : null));
    };

    const handleBlockChange = (blockId, field, value) => {
      setTemplate(prev => {
        if (!prev) return null;
        const newBlocks = prev.blocks.map(b =>
          b.id === blockId ? { ...b, [field]: value } : b
        );
        return { ...prev, blocks: newBlocks };
      });
    };

    const handleUpdateAndCloseEditDialog = () => {
        if (!editingBlock) return;
        // This triggers the main template state update
        handleBlockChange(editingBlock.id, 'title', editingBlock.title);
        handleBlockChange(editingBlock.id, 'content', editingBlock.content);
        handleBlockChange(editingBlock.id, 'rules', editingBlock.rules);
        setEditingBlock(null);
        toast.success(`Bloco "${editingBlock.title}" atualizado.`);
    };

    const handleAddNewBlock = () => {
        const newBlock = {
            id: uuidv4(),
            title: `Novo Bloco ${template.blocks.length + 1}`,
            content: 'Exemplo de conteúdo...',
            rules: 'Regras para a IA...'
        };
        setTemplate(prev => ({
            ...prev,
            blocks: [...prev.blocks, newBlock]
        }));
        setEditingBlock(newBlock); // Open editor for the new block immediately
        toast.success('Novo bloco adicionado. Edite os detalhes abaixo.');
    };

    const handleDeleteBlock = (blockId) => {
        setTemplate(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== blockId)
        }));
        toast.success('Bloco removido.');
    };


    const handleExportToWord = async () => {
        if (!template || !template.id) {
            toast.error('O modelo precisa ser salvo antes de ser exportado.');
            return;
        }

        setIsSaving(true); // Re-use saving indicator for export
        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    exportType: 'template',
                    templateId: template.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || `Falha na exportação: ${response.statusText}`);
            }

            const blob = await response.blob();
            saveAs(blob, `${template.name || 'template'}.docx`);
            toast.success('Modelo exportado para Word com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar modelo para Word:', error);
            toast.error(`Falha ao exportar modelo: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !template) {
        return <LoadingDialog open={true} title="Carregando Modelo de Briefing..." />;
    }

    if (error) {
        return <Typography color="error" sx={{ p: 3 }}>Erro ao carregar o modelo: {error}</Typography>;
    }

    const dynamicBlockOrder = parseBlockOrderFromRules(template.generalRules);
    const sortedBlocks = [...template.blocks].sort((a, b) => {
        const lowerCaseDynamicOrder = dynamicBlockOrder.map(t => t.toLowerCase());
        const indexA = lowerCaseDynamicOrder.indexOf(a.title.toLowerCase());
        const indexB = lowerCaseDynamicOrder.indexOf(b.title.toLowerCase());
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant={isMobile ? 'h5' : 'h4'} component="h1">
                        Editor de Modelo de Briefing
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasUnsavedChanges && <Chip label="Alterações não salvas" size="small" color="warning" />}
                        <Button
                            startIcon={<Save />}
                            onClick={handleManualSave}
                            variant="contained"
                            disabled={!hasUnsavedChanges}
                        >
                            {!isMobile && 'Salvar'}
                        </Button>
                        <Button
                            startIcon={<Download />}
                            onClick={handleExportToWord}
                            variant="outlined"
                        >
                            {!isMobile && 'Exportar'}
                        </Button>
                    </Box>
                </Box>

                <Typography variant="h6" gutterBottom>Regras Gerais para a IA</Typography>
                <Paper
                    variant="outlined"
                    onClick={() => setFocusModeTarget('generalRules')}
                    sx={{ p: 2, mb: 4, cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                >
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', minHeight: '4em' }}>
                        {highlightOrderRule(template.generalRules) || 'Clique para definir as regras gerais e a ordem dos blocos...'}
                    </Typography>
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Blocos do Modelo</Typography>
                    <Button variant="contained" startIcon={<Add />} onClick={handleAddNewBlock}>
                        Adicionar Bloco
                    </Button>
                </Box>

                {sortedBlocks.map((block) => (
                    <Accordion key={block.id} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ flexGrow: 1, fontWeight: 'medium' }}>{block.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>Conteúdo do Exemplo</Typography>
                                    <Paper
                                        variant="outlined"
                                        sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', minHeight: '100px', maxHeight: '200px', overflowY: 'auto' }}
                                        dangerouslySetInnerHTML={{ __html: block.content.replace(/\n/g, '<br />') || '<i>Vazio</i>' }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>Instruções para a IA</Typography>
                                    <Paper
                                        variant="outlined"
                                        sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', minHeight: '100px', maxHeight: '200px', overflowY: 'auto' }}
                                        dangerouslySetInnerHTML={{ __html: block.rules.replace(/\n/g, '<br />') || '<i>Vazio</i>' }}
                                    />
                                </Grid>
                            </Grid>
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                               <IconButton size="small" onClick={() => handleDeleteBlock(block.id)} color="error">
                                    <Delete />
                                </IconButton>
                                <Button size="small" startIcon={<Edit />} onClick={() => setEditingBlock(block)}>
                                    Editar Detalhes
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                ))}

            </Paper>

            {/* Editing Dialog for Blocks */}
            {editingBlock && (
                <Dialog open={Boolean(editingBlock)} onClose={() => setEditingBlock(null)} fullWidth maxWidth="lg">
                    <DialogTitle>Editando Bloco: "{editingBlock.title}"</DialogTitle>
                    <DialogContent>
                        <TextField
                            label="Título do Bloco"
                            fullWidth
                            variant="outlined"
                            value={editingBlock.title}
                            onChange={(e) => setEditingBlock(prev => ({ ...prev, title: e.target.value }))}
                            sx={{ mt: 2, mb: 2 }}
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>Conteúdo do Bloco (Exemplo)</Typography>
                                <Box sx={{ height: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                    <TextEditor
                                        value={editingBlock.content}
                                        onChange={(val) => setEditingBlock(prev => ({ ...prev, content: val }))}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>Instruções para a IA (Regras)</Typography>
                                <Box sx={{ height: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                    <TextEditor
                                        value={editingBlock.rules}
                                        onChange={(val) => setEditingBlock(prev => ({ ...prev, rules: val }))}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditingBlock(null)}>Cancelar</Button>
                        <Button onClick={handleUpdateAndCloseEditDialog} variant="contained">
                            Salvar Alterações
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Editing Dialog for General Rules */}
            {focusModeTarget === 'generalRules' && (
                <Dialog open={true} onClose={() => setFocusModeTarget(null)} fullWidth maxWidth="md">
                    <DialogTitle>Editar Regras Gerais e Ordem dos Blocos</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                            Defina aqui as regras gerais. Para controlar a ordem dos blocos, adicione uma linha como:
                            <br />
                            <code style={{backgroundColor: 'rgba(255,255,0,0.5)'}}>EXATAMENTE nesta ordem: Título, Mensagem, CTA</code>
                        </Typography>
                        <Box sx={{ height: 500, mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <TextEditor
                                value={template.generalRules}
                                onChange={(val) => handleTemplateChange('generalRules', val)}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setFocusModeTarget(null)}>Fechar</Button>
                    </DialogActions>
                </Dialog>
            )}

            <SavingModal open={isSaveModalOpen} title="Salvando alterações..." />
        </Box>
    );
};

export default BriefingTemplatePage;