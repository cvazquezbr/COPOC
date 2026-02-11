import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea, CardContent, Typography, Grid, Container } from '@mui/material';

const SelectionPage = () => {
  const navigate = useNavigate();

  const handleSelection = (path) => {
    navigate(path);
  };

  return (
    <Container maxWidth="md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100vh' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Selecione uma opção
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} sm={6}>
          <Card onClick={() => handleSelection('/briefings')}>
            <CardActionArea style={{ padding: '2rem' }}>
              <CardContent>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Gestão de Briefings
                </Typography>
                <Typography variant="body2" color="textSecondary" component="p" align="center">
                  Crie e gerencie seus briefings.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card onClick={() => handleSelection('/instagram-extractor')}>
            <CardActionArea style={{ padding: '2rem' }}>
              <CardContent>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Extração de Vídeos (Instagram)
                </Typography>
                <Typography variant="body2" color="textSecondary" component="p" align="center">
                  Extraia links diretos MP4 de posts e Reels.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card onClick={() => handleSelection('/transcricoes')}>
            <CardActionArea style={{ padding: '2rem' }}>
              <CardContent>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Gestão de Transcrições
                </Typography>
                <Typography variant="body2" color="textSecondary" component="p" align="center">
                  Transcreva áudio de vídeos.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SelectionPage;
