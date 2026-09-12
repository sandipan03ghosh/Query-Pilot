import React, { useRef, memo, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Button,
  IconButton,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import { useTheme } from '@mui/material/styles';
import SqlControls from './SqlControls';

const SessionMessages = memo(({
  currentSession,
  messagesEndRef,
  showSqlControls,
  generatedSql,
  copyToClipboard,
  discardGeneratedSql,
  executeGeneratedSql,
  generateResultsSummary,
  showPreviousQueryResults,
  handleDeleteQuery,
  onFeedback,
}) => {
  const theme = useTheme();

  // Empty session message when no queries exist
  const EmptySessionMessage = () => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      opacity: 0.8
    }}>
      <Typography variant="h5" sx={{ 
        color: alpha(theme.palette.text.secondary, 0.8), 
        fontWeight: 300,
        textAlign: 'center',
        mb: 2,
      }}>
        Start a new conversation
      </Typography>
      <Typography variant="body1" sx={{ 
        color: alpha(theme.palette.text.secondary, 0.7), 
        mt: 1,
        textAlign: 'center',
        maxWidth: '450px'
      }}>
        Ask questions about your database using natural language
      </Typography>
      <Box sx={{ 
        mt: 5, 
        p: 3, 
        borderRadius: 2, 
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        maxWidth: '80%',
        border: '1px dashed',
        borderColor: alpha(theme.palette.divider, 0.6)
      }}>
        <Typography variant="body2" fontWeight={500} sx={{ color: theme.palette.text.secondary }}>
          Example questions:
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: theme.palette.primary.light }}>
          • Show me all users who joined in the last 30 days
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: theme.palette.primary.light }}>
          • What are the top 5 products by revenue?
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: theme.palette.primary.light }}>
          • Find orders with items that cost more than $100
        </Typography>
      </Box>
    </Box>
  );

  // Message item component to display a query/response pair
  const MessageItem = memo(({ item, index }) => {
    // Memoize result summary to prevent recalculation on every render
    const resultSummary = useMemo(() => generateResultsSummary(item.response), [item.response]);
    const { previewText } = resultSummary;

    // Determine message appearance based on success status
    const messageStyle = item.success ? {
      backgroundImage: 'linear-gradient(135deg, rgba(100, 95, 190, 0.05) 0%, rgba(80, 110, 200, 0.15) 100%)',
      border: '1px solid',
      borderColor: alpha(theme.palette.divider, 0.4),
    } : {
      backgroundImage: 'linear-gradient(135deg, rgba(250, 100, 100, 0.05) 0%, rgba(250, 100, 100, 0.15) 100%)',
      border: '1px solid',
      borderColor: alpha(theme.palette.error.main, 0.4),
    };

    return (
      <Box sx={{ width: '100%', my: 2 }}>
        {/* User message */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ maxWidth: { xs: '80%', md: '70%' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5, mr: 1 }}>
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.8) }}>
                You
              </Typography>
            </Box>
            <Paper 
              elevation={0}
              sx={{
                p: 2,
                color: 'white',
                backgroundImage: 'linear-gradient(45deg, #4776D0 10%, #6596EB 60%, #7EABFF 95%)',
                borderRadius: '16px 16px 4px 16px',
                boxShadow: '0 2px 15px rgba(101, 150, 235, 0.4)',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 20px rgba(101, 150, 235, 0.5)',
                }
              }}
            >
              <Typography variant="body1">{item.prompt}</Typography>
            </Paper>
          </Box>
          <Avatar 
            sx={{ 
              ml: 1, 
              bgcolor: theme.palette.primary.dark,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }} 
            alt="User"
          >
            <PersonIcon />
          </Avatar>
        </Box>
        
        {/* System message */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
          <Avatar 
            sx={{ 
              mr: 1, 
              bgcolor: item.success ? theme.palette.secondary.dark : theme.palette.error.dark,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }} 
            alt="AI"
          >
            <SmartToyIcon />
          </Avatar>
          <Box sx={{ maxWidth: { xs: '85%', md: '75%' } }}>
            <Box sx={{ display: 'flex', mb: 0.5, ml: 1 }}>
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.8) }}>
                {item.success ? "AI Assistant" : `Error: ${item.error_type || "Processing Error"}`}
              </Typography>
            </Box>
            <Paper 
              elevation={0}
              sx={{
                p: 2,
                color: theme.palette.text.primary,
                ...messageStyle,
                backdropFilter: 'blur(10px)',
                borderRadius: '16px 16px 16px 4px',
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                '&:hover': {
                  backgroundImage: item.success 
                    ? 'linear-gradient(135deg, rgba(100, 95, 190, 0.1) 0%, rgba(80, 110, 200, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(250, 100, 100, 0.1) 0%, rgba(250, 100, 100, 0.2) 100%)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)',
                  borderColor: item.success
                    ? alpha(theme.palette.primary.main, 0.2)
                    : alpha(theme.palette.error.main, 0.2),
                }
              }}
            >
              <Typography 
                variant="body1" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  '& code': {
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                    fontFamily: 'monospace',
                    p: 0.5,
                    borderRadius: 1,
                  },
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%',
                    my: 1.5,
                    overflowX: 'auto',
                    display: 'block',
                  },
                  '& th': {
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                    p: 1,
                    textAlign: 'left',
                    fontWeight: 500,
                    color: theme.palette.primary.light,
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                  },
                  '& td': {
                    p: 1,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  }
                }}
              >
                {previewText}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: alpha(theme.palette.text.secondary, 0.6)
                  }}
                >
                  {new Date(item.created_at).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {item.confidence_score != null && (
                    <Chip
                      size="small"
                      label={`${item.confidence_score}/100`}
                      sx={{
                        mr: 1, fontWeight: 600,
                        color: item.confidence_score >= 75
                          ? theme.palette.success.main
                          : item.confidence_score >= 55
                          ? theme.palette.warning.main
                          : theme.palette.error.main,
                      }}
                      variant="outlined"
                    />
                  )}
                  {item.generated_sql && onFeedback && (
                    <>
                      <Tooltip title="This answer was right">
                        <IconButton
                          size="small"
                          onClick={() => onFeedback(item.id, item.feedback === 'up' ? null : 'up')}
                          sx={{ color: item.feedback === 'up' ? theme.palette.success.main : 'inherit' }}
                        >
                          <ThumbUpAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="This answer was wrong">
                        <IconButton
                          size="small"
                          onClick={() => onFeedback(item.id, item.feedback === 'down' ? null : 'down')}
                          sx={{ color: item.feedback === 'down' ? theme.palette.error.main : 'inherit' }}
                        >
                          <ThumbDownAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => showPreviousQueryResults(item)}
                    startIcon={<VisibilityIcon />}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 500,
                      px: 2,
                      py: 0.5,
                      ml: 2,
                      borderWidth: '1.5px',
                      '&:hover': {
                        borderWidth: '1.5px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    View Details
                  </Button>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleDeleteQuery(item.id)}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    );
  });

  // Memoize the message items array to avoid recreating on every render
  const messageItems = useMemo(() => {
    if (!currentSession?.queries || currentSession.queries.length === 0) {
      return null;
    }
    
    return currentSession.queries.map((item, index) => (
      <MessageItem key={`message-${item.id || index}`} item={item} index={index} />
    ));
  }, [currentSession?.queries]);

  return (
    <Box 
      sx={{ 
        flexGrow: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        pb: '90px', // Space for the input box
        px: { xs: 2, md: 4 },
        scrollbarWidth: 'thin',
        scrollbarColor: `${alpha(theme.palette.primary.main, 0.2)} transparent`,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.primary.main, 0.2),
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: alpha(theme.palette.primary.main, 0.4),
        },
      }}
    >
      {/* SQL Controls Component */}
      <SqlControls
        showSqlControls={showSqlControls}
        generatedSql={generatedSql}
        copyToClipboard={copyToClipboard}
        discardGeneratedSql={discardGeneratedSql}
        executeGeneratedSql={executeGeneratedSql}
      />

      {/* Show empty state or message history */}
      {!currentSession?.queries || currentSession.queries.length === 0 ? (
        <EmptySessionMessage />
      ) : (
        <React.Fragment>
          {messageItems}
        </React.Fragment>
      )}
      
      <div ref={messagesEndRef} />
    </Box>
  );
});

export default SessionMessages;