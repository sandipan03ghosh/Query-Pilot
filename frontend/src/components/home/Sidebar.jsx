import React from 'react';
import { 
  Box,
  Typography,
  Button,
  alpha,
} from "@mui/material";
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import SessionSelector from "../../components/SessionSelector";

const Sidebar = ({ 
  sidebarWidth, 
  currentSessionId, 
  loadSession, 
  currentSession 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: sidebarWidth,
        height: '100%',
        position: 'fixed',
        left: 0,
        top: 64,
        bottom: 0,
        bgcolor: alpha(theme.palette.background.paper, 0.97),
        backdropFilter: 'blur(4px)',
        borderRight: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.7),
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '0 0 20px rgba(0,0,0,0.1)',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
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
      <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
  );
};

export default Sidebar;