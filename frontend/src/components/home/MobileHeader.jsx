import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  Chip,
  alpha,
  Drawer,
  Box,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import SessionSelector from "../../components/SessionSelector";

const MobileHeader = ({ 
  currentSession,
  drawerOpen,
  setDrawerOpen,
  sidebarWidth,
  currentSessionId,
  loadSession
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <>
      <AppBar position="static" elevation={0} sx={{ 
        zIndex: 1000,
        backgroundImage: 'linear-gradient(rgba(30, 36, 50, 0.97), rgba(21, 26, 37, 0.95))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontWeight: 600,
            background: 'linear-gradient(45deg, #6596EB, #BB86FC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', 
          }}>
            LLM Query System
            {currentSession && (
              <Chip 
                label={currentSession.title}
                size="small"
                sx={{ 
                  ml: 2, 
                  color: 'white', 
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  backgroundColor: alpha(theme.palette.background.paper, 0.2),
                  backdropFilter: 'blur(4px)',
                  fontWeight: 500,
                }}
                variant="outlined"
              />
            )}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => navigate('/logout')}
            sx={{
              color: theme.palette.primary.light,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
              }
            }}
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': { 
            width: sidebarWidth,
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            backdropFilter: 'blur(8px)',
            color: theme.palette.text.primary,
            borderRight: '1px solid',
            borderColor: alpha(theme.palette.divider, 0.5),
            boxShadow: '0 0 20px rgba(0,0,0,0.2)'
          },
        }}
      >
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid', 
            borderColor: 'divider',
            backgroundImage: 'linear-gradient(rgba(30, 36, 50, 0.5), rgba(21, 26, 37, 0.8))',
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              background: 'linear-gradient(45deg, #6596EB, #BB86FC)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              LLM Query System
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentSession?.database_name && `Database: ${currentSession.database_name}`}
            </Typography>
          </Box>
          <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
            <SessionSelector 
              currentSessionId={currentSessionId}
              onSessionSelect={loadSession}
              fullHeight={true}
              databaseId={currentSession?.database_id}
            />
          </Box>
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid', 
            borderColor: 'divider',
            backgroundImage: 'linear-gradient(rgba(21, 26, 37, 0.8), rgba(30, 36, 50, 0.5))',
          }}>
            <Button 
              fullWidth 
              variant="outlined" 
              color="primary" 
              onClick={() => navigate('/logout')}
              startIcon={<LogoutIcon />}
              sx={{
                borderRadius: '8px',
                py: 1,
                borderWidth: '1.5px',
                '&:hover': {
                  borderWidth: '1.5px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  transform: 'translateY(-2px)',
                }
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default MobileHeader;