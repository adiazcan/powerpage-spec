import { Box, CircularProgress } from '@mui/material';

export function LoadingSpinner() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" py={4}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
