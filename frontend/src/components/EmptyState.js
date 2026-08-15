import React from 'react';
import { Box, Typography } from '@mui/material';

const EmptyState = ({ icon, title, description, action, compact = false }) => (
  <Box sx={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    px: 3, py: compact ? 4 : 7, border: '1px dashed', borderColor: 'divider',
    borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)',
  }}>
    {icon && (
      <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, mb: 1.5,
        borderRadius: 2.5, color: 'primary.main', backgroundColor: 'rgba(11,143,140,0.10)' }}>
        {icon}
      </Box>
    )}
    <Typography variant="h3">{title}</Typography>
    {description && <Typography color="text.secondary" sx={{ mt: 0.75, mb: action ? 2 : 0 }}>{description}</Typography>}
    {action}
  </Box>
);

export default EmptyState;
