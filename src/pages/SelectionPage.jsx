import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Grid,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import HearingIcon from '@mui/icons-material/Hearing';

const SelectionPage = () => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
          Selecione o que você quer fazer
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} sm={6}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderRadius: 2,
              }}
            >
              <DescriptionIcon sx={{ fontSize: 60 }} color="primary" />
              <Typography variant="h6">Gestão de Briefings</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Crie, edite e gerencie seus briefings de forma eficiente.
              </Typography>
              <Button
                variant="contained"
                onClick={() => handleNavigation('/briefings')}
                fullWidth
              >
                Acessar Briefings
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderRadius: 2,
              }}
            >
              <HearingIcon sx={{ fontSize: 60 }} color="secondary" />
              <Typography variant="h6">Gestão de Transcrições</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Transcreva áudios de vídeos de forma rápida e precisa.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => handleNavigation('/transcriptions')}
                fullWidth
              >
                Acessar Transcrições
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default SelectionPage;
