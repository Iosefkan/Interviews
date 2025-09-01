import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Interview: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          AI Interview Session
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Interview interface with voice recording and real-time AI interaction will be implemented here.
        </Typography>
      </Box>
    </Container>
  );
};

export default Interview;