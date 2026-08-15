import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

const PageHeader = ({ eyebrow, title, description, actions }) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
    justifyContent="space-between"
    spacing={2}
    sx={{ mb: { xs: 3, md: 4 } }}
  >
    <Box sx={{ maxWidth: 720 }}>
      {eyebrow && (
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.12em' }}>
          {eyebrow}
        </Typography>
      )}
      <Typography variant="h1" component="h1">{title}</Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.65 }}>{description}</Typography>
      )}
    </Box>
    {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
  </Stack>
);

export default PageHeader;
