import React from 'react';
import { Typography, Box, Link, List, ListItem, ListItemText } from '@mui/material';

const GeminiInfobox = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Obtendo sua Chave da API Gemini (Google AI Studio)
      </Typography>
      <Typography variant="body1" paragraph>
        Para usar os recursos de IA generativa desta aplicação, você precisará de uma chave de API do Google AI Studio. Siga os passos abaixo para obter a sua.
      </Typography>
      <List dense>
        <ListItem>
          <ListItemText
            primary="1. Acesse o Google AI Studio"
            secondary={
              <>
                Navegue até{' '}
                <Link href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">
                  aistudio.google.com
                </Link>
                {' '}e faça login com sua conta do Google.
              </>
            }
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="2. Crie uma Chave de API"
            secondary='No painel esquerdo, clique em "Get API key". Na página seguinte, clique em "Create API key in new project".'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="3. Copie sua Chave"
            secondary="Sua nova chave de API será exibida. Copie-a e cole no campo de chave de API nesta aplicação."
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="4. Armazenamento Seguro"
            secondary="Sua chave de API será armazenada com segurança no banco de dados da aplicação e usada apenas para interagir com a API Gemini em seu nome."
          />
        </ListItem>
      </List>
      <Typography variant="caption" color="text.secondary">
        Nota: O uso da API Gemini está sujeito aos termos de serviço e à política de preços do Google.
      </Typography>
    </Box>
  );
};

export default GeminiInfobox;