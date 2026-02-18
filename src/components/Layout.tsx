import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AuthButton } from './AuthButton';

/**
 * App shell — renders the persistent header (site title + auth button),
 * the routed page content via <Outlet />, and a minimal footer.
 */
export function Layout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" component="header" role="banner">
        <Toolbar>
          <Button
            href="#main-content"
            color="inherit"
            sx={{ mr: 2 }}
            aria-label="Skip to main content"
          >
            Skip to main content
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Support Portal
          </Typography>
          <AuthButton />
        </Toolbar>
      </AppBar>

      <Container component="main" id="main-content" sx={{ flex: 1, py: 3 }} tabIndex={-1}>
        <Outlet />
      </Container>

      <Box
        component="footer"
        role="contentinfo"
        sx={{ py: 2, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" color="text.secondary">
          &copy; {new Date().getFullYear()} Support Portal
        </Typography>
      </Box>
    </Box>
  );
}
