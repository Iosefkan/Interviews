import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Results: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Interview Results
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Detailed interview results and PDF report generation will be implemented here.
        </Typography>
      </Box>
    </Container>
  );
};

export default Results;