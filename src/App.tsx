import { Box, Button, Stack, Typography } from '@mui/material';
import {
  RouterProvider,
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router-dom';
import { AuthGuard } from '@/components/AuthGuard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Layout } from '@/components/Layout';
import { ApiError } from '@/services/api-client';
import { TicketList } from '@/pages/TicketList';
import { TicketDetail } from '@/pages/TicketDetail';
import { CreateTicket } from '@/pages/CreateTicket';
import { Confirmation } from '@/pages/Confirmation';

function AuthorizationErrorPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Not Authorized</Typography>
      <Typography variant="body1">
        You are not authorized to access this content.
      </Typography>
      <Box>
        <Button href="/" variant="contained">
          Back to ticket list
        </Button>
      </Box>
    </Stack>
  );
}

function NotFoundPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Page Not Found</Typography>
      <Typography variant="body1">
        The page you requested could not be found.
      </Typography>
      <Box>
        <Button href="/" variant="contained">
          Back to ticket list
        </Button>
      </Box>
    </Stack>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return <AuthorizationErrorPage />;
    }
    if (error.status === 404) {
      return <NotFoundPage />;
    }
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return <AuthorizationErrorPage />;
    }
    if (error.status === 404) {
      return <NotFoundPage />;
    }
  }

  const fallbackMessage = error instanceof Error ? error.message : 'An unexpected network error occurred.';

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Unexpected Error</Typography>
      <ErrorBanner message={fallbackMessage} />
      <Box>
        <Button href="/" variant="contained">
          Back to ticket list
        </Button>
      </Box>
    </Stack>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <TicketList /> },
      { path: 'tickets/new', element: <CreateTicket /> },
      { path: 'tickets/:id/confirm', element: <Confirmation /> },
      { path: 'tickets/:id', element: <TicketDetail /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
