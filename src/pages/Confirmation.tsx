import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';

interface ConfirmationLocationState {
  ticketNumber?: string;
}

export function Confirmation() {
  const { id } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as ConfirmationLocationState;

  const ticketNumber = state.ticketNumber ?? id;

  return (
    <Stack spacing={3} role="status" aria-live="polite">
      <Typography variant="h4">Ticket Created</Typography>
      <Typography variant="body1">
        Your support request has been submitted successfully.
      </Typography>
      <Typography variant="body1">
        Ticket Number: <strong>{ticketNumber}</strong>
      </Typography>

      <Box display="flex" gap={2}>
        <Button component={RouterLink} to={`/tickets/${id}`} variant="contained" aria-label="View ticket details">
          View ticket details
        </Button>
        <Button component={RouterLink} to="/" variant="outlined" aria-label="Return to ticket list">
          Return to ticket list
        </Button>
      </Box>
    </Stack>
  );
}
