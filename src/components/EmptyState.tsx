import { Box, Typography, Button } from '@mui/material';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  headline: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, headline, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={6}
      textAlign="center"
    >
      {icon && <Box mb={2}>{icon}</Box>}
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {headline}
      </Typography>
      {ctaLabel && onCta && (
        <Button variant="contained" onClick={onCta} sx={{ mt: 2 }}>
          {ctaLabel}
        </Button>
      )}
    </Box>
  );
}
