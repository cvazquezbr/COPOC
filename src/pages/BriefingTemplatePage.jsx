import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress, TextField, Paper, Card, CardContent, CardActions, Accordion, AccordionSummary, AccordionDetails, IconButton, Tooltip, Container
} from '@mui/material';
import { Edit, Save, Download, ExpandMore as ExpandMoreIcon, Add } from '@mui/icons-material';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Packer } from 'docx';
import { saveAs } from 'file-saver';
import { Document, Paragraph, TextRun, HeadingLevel } from 'docx';

import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import TextEditor from '../components/TextEditor';
import LoadingDialog from '../components/LoadingDialog';

const defaultBlockOrder = [
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

const parseBlockOrderFromRules = (rules) => {
    if (!rules) return defaultBlockOrder;

    // Use the same regex as highlightOrderRule for consistency.
    const match = rules.match(/(?:EXATAMENTE nesta ordem:)([\s\S]*?)(?=R\d+\.|\s*$)/i);
    if (!match || !match[1]) {
        return defaultBlockOrder;
    }

    const blockListText = match[1];
    const blockTitles = blockListText
        .split('\n')
        .map(line => line.replace(/^-|\*|^\d+\.\s*/, '').trim()) // Robustly remove list markers
        .filter(line => line); // Filter out any empty lines after trimming

    return blockTitles.length > 0 ? blockTitles : defaultBlockOrder;
};

const BriefingTemplatePage = () => {
  const [template, setTemplate] = useState(defaultBriefingTemplate);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null); // For the block editing dialog
  const [focusModeTarget, setFocusModeTarget] = useState(null); // For the general rules dialog
  const isInitialMount = useRef(true);

  // Debounced auto-save for the template
  useEffect(() => {
    const handler = setTimeout(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      const saveTemplate = async () => {
        setIsSaving(true);
        try {
          const response = await fetch('/api/briefing-template', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_data: template }),
          });
          if (!response.ok) throw new Error('Falha ao salvar o modelo.');
          // Use a success toast for explicit saves, but maybe just a console log for auto-saves
          console.log("Template auto-saved successfully.");
        } catch (error) {
          toast.error(`Erro ao salvar o modelo: ${error.message}`);
          setError(error.message);
        } finally {
          setIsSaving(false);
        }
      };
      saveTemplate();
    }, 2000); // Debounce delay of 2 seconds

    return () => {
      clearTimeout(handler);
    };
  }, [template]);

  // This function is the single source of truth for synchronizing blocks.
  const syncBlocksWithRules = (currentTemplate) => {
    const parsedTitles = parseBlockOrderFromRules(currentTemplate.generalRules);
    // Use lowercase titles for the map keys to ensure case-insensitive matching.
    const existingBlocksMap = new Map(currentTemplate.blocks.map(b => [b.title.toLowerCase(), b]));

    const newBlocks = parsedTitles.map(title => {
        const lowerCaseTitle = title.toLowerCase();
        if (existingBlocksMap.has(lowerCaseTitle)) {
            // Retrieve the existing block but update its title to match the casing from the rules.
            const existingBlock = existingBlocksMap.get(lowerCaseTitle);
            return { ...existingBlock, title: title };
        }
        return {
            id: uuidv4(),
            title: title, // Preserve the casing from the rules.
            content: '',
            rules: ''
        };
    });

    // Check if the block list has actually changed to avoid unnecessary re-renders
    if (newBlocks.length !== currentTemplate.blocks.length || !newBlocks.every((block, index) => block.id === currentTemplate.blocks[index]?.id && block.title === currentTemplate.blocks[index]?.title)) {
        return { ...currentTemplate, blocks: newBlocks };
    }
    return currentTemplate;
  };

  // Effect for syncing when `generalRules` changes AFTER initial load.
  useEffect(() => {
    if (isInitialMount.current || isLoading) {
      return;
    }
    setTemplate(currentTemplate => syncBlocksWithRules(currentTemplate));
  }, [template.generalRules, isLoading]);


  // Fetch template on component mount and perform initial sync.
  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/briefing-template');
        if (!response.ok) {
          if (response.status === 404) {
            toast.info('Nenhum modelo salvo encontrado, usando o padrão.');
            setTemplate(syncBlocksWithRules(defaultBriefingTemplate));
          } else {
            throw new Error(`Failed to fetch template: ${response.statusText}`);
          }
          return;
        }

        const result = await response.json();
        let templateData;

        if (result && result.length > 0 && result[0].template_data) {
          const rawData = result[0].template_data;
          templateData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          toast.info('Seu modelo de briefing foi carregado.');
        } else {
          templateData = defaultBriefingTemplate;
          toast.info('Usando modelo de briefing padrão.');
        }

        // Perform the first sync right after loading the data.
        setTemplate(syncBlocksWithRules(templateData));

      } catch (error) {
        toast.error(`Erro ao carregar seu modelo de briefing: ${error.message}`);
        setError(error.message);
        setTemplate(syncBlocksWithRules(defaultBriefingTemplate)); // Fallback on any exception
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, []);

  const handleTemplateChange = (field, value) => {
    setTemplate(prev => ({ ...prev, [field]: value }));
  };

  const handleBlockChange = (blockId, field, value) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, [field]: value } : b
      )
    }));
  };

  const handleAddNewBlock = () => {
    const newBlock = {
      id: uuidv4(),
      title: 'Novo Bloco',
      content: 'Exemplo de conteúdo...',
      rules: 'Regras para a IA...'
    };
    setTemplate(prev => ({
        ...prev,
        blocks: [...prev.blocks, newBlock]
    }));
    toast.success('Novo bloco adicionado. Clique em "Editar" para customizá-lo.');
  };

  const handleExportToWord = () => {
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ text: "Modelo de Briefing", heading: HeadingLevel.TITLE }),
                new Paragraph({ text: "Regras Gerais para a IA:", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: template.generalRules, style: "Normal" }),
                ...template.blocks.flatMap(block => [
                    new Paragraph({ text: block.title, heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
                    new Paragraph({ text: "Conteúdo do Exemplo:", style: "Normal" }),
                    ...block.content.split('\n').map(line => new Paragraph({ text: line })),
                    new Paragraph({ text: "Instruções para a IA:", style: "Normal", spacing: { before: 200 } }),
                    ...block.rules.split('\n').map(line => new Paragraph({ children: [new TextRun({ text: line, italics: true, color: "000080", size: 20 })] })),
                ]),
            ],
        }],
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "modelo_de_briefing.docx");
        toast.success("Modelo exportado para Word com sucesso!");
    }).catch(err => {
        toast.error(`Erro ao exportar para Word: ${err.message}`);
    });
  };

  if (isLoading) {
    return <LoadingDialog open={true} title="Carregando Modelo de Briefing..." />;
  }

  if (error) {
    return <Typography color="error">Erro ao carregar o modelo: {error}</Typography>;
  }

  const dynamicBlockOrder = parseBlockOrderFromRules(template.generalRules);

  const sortedBlocks = [...template.blocks].sort((a, b) => {
    const lowerCaseDynamicOrder = dynamicBlockOrder.map(t => t.toLowerCase());
    const indexA = lowerCaseDynamicOrder.indexOf(a.title.toLowerCase());
    const indexB = lowerCaseDynamicOrder.indexOf(b.title.toLowerCase());

    // Handle cases where a title might not be in the dynamic order list
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1">
                    Editor de Modelo de Briefing
                </Typography>
                <Box>
                    <Button
                        startIcon={<Download />}
                        onClick={handleExportToWord}
                    >
                        Exportar para Word
                    </Button>
                </Box>
            </Box>

            {/* General Rules Section */}
            <Typography variant="h6" gutterBottom>Regras Gerais para a IA</Typography>
            <Paper
              variant="outlined"
              onClick={() => setFocusModeTarget('generalRules')}
              sx={{ p: 2, mb: 4, cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {highlightOrderRule(template.generalRules) || 'Clique para editar...'}
              </Typography>
            </Paper>

            {/* Blocks Section */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Blocos do Modelo</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={handleAddNewBlock}>
                    Adicionar Bloco
                </Button>
            </Box>

            {sortedBlocks.map((block) => (
                <Accordion key={block.id} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ flexGrow: 1 }}>{block.title}</Typography>
                        <Button size="small" startIcon={<Edit />} onClick={(e) => { e.stopPropagation(); setEditingBlock(block); }}>
                            Editar
                        </Button>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>Conteúdo do Exemplo</Typography>
                                <Paper
                                    variant="outlined"
                                    sx={{ p: 2, backgroundColor: 'grey.100', minHeight: '100px', overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: block.content.replace(/\n/g, '<br />') }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>Instruções para a IA</Typography>
                                <Paper
                                    variant="outlined"
                                    sx={{ p: 2, backgroundColor: 'grey.100', minHeight: '100px', overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: block.rules.replace(/\n/g, '<br />') }}
                                />
                            </Grid>
                        </Grid>
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
                                    html={false}
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>Instruções para a IA (Regras)</Typography>
                            <Box sx={{ height: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <TextEditor
                                    value={editingBlock.rules}
                                    onChange={(val) => setEditingBlock(prev => ({ ...prev, rules: val }))}
                                    html={false}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingBlock(null)}>Cancelar</Button>
                    <Button
                        onClick={() => {
                            handleBlockChange(editingBlock.id, 'title', editingBlock.title);
                            handleBlockChange(editingBlock.id, 'content', editingBlock.content);
                            handleBlockChange(editingBlock.id, 'rules', editingBlock.rules);
                            setEditingBlock(null);
                            toast.success(`Bloco "${editingBlock.title}" atualizado.`);
                        }}
                        variant="contained"
                    >
                        Salvar Alterações
                    </Button>
                </DialogActions>
            </Dialog>
        )}

        {/* Editing Dialog for General Rules */}
        {focusModeTarget === 'generalRules' && (
            <Dialog open={true} onClose={() => setFocusModeTarget(null)} fullWidth maxWidth="md">
                <DialogTitle>Editar Regras Gerais</DialogTitle>
                <DialogContent>
                    <Box sx={{ height: 500, mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <TextEditor
                            value={template.generalRules}
                            onChange={(val) => handleTemplateChange('generalRules', val)}
                            html={false}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFocusModeTarget(null)}>Fechar</Button>
                </DialogActions>
            </Dialog>
        )}
    </Container>
  );
};

export default BriefingTemplatePage;