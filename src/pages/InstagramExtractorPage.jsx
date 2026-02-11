import React, { useState } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { toast } from 'sonner';

const InstagramExtractorPage = () => {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBack = () => {
    navigate('/');
  };

  const handleExtract = async () => {
    // Split by newlines or commas and filter empty strings
    const urls = urlInput
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      toast.error('Por favor, insira pelo menos uma URL do Instagram.');
      return;
    }

    if (urls.length > 5) {
      toast.error('O limite é de 5 URLs por vez.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/instagram/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Erro ao processar a solicitação.');
      }

      const data = await response.json();
      setResults(data);
      toast.success('Extração concluída!');
    } catch (err) {
      console.error('Error extracting URLs:', err);
      setError(err.message);
      toast.error('Erro ao extrair URLs.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado para a área de transferência!');
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>
          Voltar
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Extração de Vídeos Instagram
        </Typography>

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="body1" gutterBottom>
            Insira até 5 URLs de posts ou Reels do Instagram (uma por linha ou separadas por vírgula).
          </Typography>
          <TextField
            label="URLs do Instagram"
            multiline
            rows={5}
            fullWidth
            variant="outlined"
            placeholder="https://www.instagram.com/p/...\nhttps://www.instagram.com/reels/..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isLoading}
            sx={{ mt: 2, mb: 2 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleExtract}
            disabled={isLoading || !urlInput.trim()}
            fullWidth
            size="large"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayCircleOutlineIcon />}
          >
            {isLoading ? 'Processando...' : 'Extrair Links MP4'}
          </Button>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            Nota: Os links MP4 gerados pelo Instagram têm validade temporária.
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {results.length > 0 && (
          <TableContainer component={Paper} elevation={3}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>URL Original</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Link MP4</TableCell>
                  <TableCell align="center">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={result.original_url}>
                        <Link href={result.original_url} target="_blank" rel="noopener">
                          {result.original_url}
                        </Link>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {result.status === 'success' ? (
                        <Typography color="success.main" variant="body2" sx={{ fontWeight: 'bold' }}>Sucesso</Typography>
                      ) : (
                        <Tooltip title={result.error || 'Erro desconhecido'}>
                          <Typography color="error.main" variant="body2" sx={{ fontWeight: 'bold', cursor: 'help' }}>Erro</Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.mp4_url ? (
                        <Tooltip title={result.mp4_url}>
                          <Typography variant="body2">{result.mp4_url}</Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {result.mp4_url && (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton size="small" onClick={() => copyToClipboard(result.mp4_url)} title="Copiar Link MP4">
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            component="a"
                            href={result.mp4_url}
                            target="_blank"
                            rel="noopener"
                            title="Abrir Vídeo"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
};

export default InstagramExtractorPage;
