import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  InputAdornment,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useTheme } from '@mui/material/styles';
import LoadingIndicator from '../../components/LoadingIndicator';

const QueryInput = ({
  query,
  setQuery,
  loading,
  currentSessionId,
  handleSubmit,
  isMobile,
  sidebarWidth
}) => {
  const theme = useTheme();
  // Local state for input to prevent full re-render during typing
  const [localQuery, setLocalQuery] = useState(query);

  // Update parent state with debounce effect
  const handleQueryChange = useCallback((e) => {
    const value = e.target.value;
    setLocalQuery(value);
    // Only update parent state when user stops typing
    const timer = setTimeout(() => {
      setQuery(value);
    }, 100); // Small delay to prevent flashing
    return () => clearTimeout(timer);
  }, [setQuery]);

  // Handle keyboard events for the text field
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If Enter is pressed without Shift, submit the form
      e.preventDefault();
      if (localQuery.trim() && !loading && currentSessionId) {
        setQuery(localQuery); // Ensure parent state is updated before submit
        handleSubmit(e);
      }
    }
    // If Shift+Enter, allow default behavior (new line)
  };

  return (
    <Box 
      component="footer"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: isMobile ? 0 : sidebarWidth,
        right: 0,
        width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`, 
        backgroundImage: 'linear-gradient(rgba(21, 26, 37, 0.6), rgba(30, 36, 50, 0.8))',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.3),
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        p: 2
      }}
    >
      <form onSubmit={(e) => {
        e.preventDefault();
        if (localQuery.trim() && !loading && currentSessionId) {
          setQuery(localQuery); // Ensure parent state is updated before submit
          handleSubmit(e);
        }
      }} style={{ width: '90%', maxWidth: '800px' }}>
        <Box sx={{ 
          display: 'flex',
          position: 'relative',
        }}>
          <TextField
            fullWidth
            placeholder="Type your message here..."
            variant="outlined"
            value={localQuery}
            onChange={handleQueryChange}
            multiline
            minRows={1}
            maxRows={3}
            onKeyDown={handleKeyDown}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={loading || !localQuery.trim() || !currentSessionId}
                    sx={{
                      minWidth: 'auto',
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      mr: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      background: 'linear-gradient(45deg, #5581D9 10%, #6596EB 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #4B74C7 10%, #5889DB 90%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    <SendIcon />
                  </Button>
                </InputAdornment>
              ),
              sx: {
                pr: 0,
                transition: 'all 0.2s ease-in-out'
              }
            }}
            sx={{
              flexGrow: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: '28px',
                bgcolor: alpha(theme.palette.background.paper, 0.3),
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease-in-out',
                '& fieldset': {
                  borderColor: alpha(theme.palette.divider, 0.5),
                  transition: 'border-color 0.2s ease-in-out',
                },
                '&:hover fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.7),
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: '2px',
                },
                '&.Mui-focused': {
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                }
              }
            }}
          />
        </Box>
      </form>
      
      {loading && (
        <Fade in={loading}>
          <Box sx={{ 
            position: 'absolute', 
            top: -48, 
            left: '50%', 
            transform: 'translateX(-50%)',
            bgcolor: alpha(theme.palette.background.paper, 0.85),
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            py: 1,
            px: 2,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <LoadingIndicator size={20} />
            <Typography variant="body2" fontWeight={500} sx={{ ml: 1.5, color: theme.palette.text.secondary }}>
              Processing your query...
            </Typography>
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default React.memo(QueryInput);