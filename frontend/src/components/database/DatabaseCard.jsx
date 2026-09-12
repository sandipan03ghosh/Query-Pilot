import React from 'react';
import { 
  Typography, 
  Box, 
  alpha, 
  CardContent,
  Tooltip,
  Button,
  IconButton,
  useTheme
} from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { MotionCard, MotionButton, MotionIconButton, MotionTypography } from './MotionComponents';
import { cardVariants } from './AnimationVariants';

const DatabaseCard = ({ db, index, handleSelectDatabase, handleQueryDatabase, openDeleteDialog }) => {
  const theme = useTheme();

  const getStatusColor = (status) => {
    switch(status) {
      case 'connected':
        return 'linear-gradient(45deg, #03DAC6 0%, #64FFDA 100%)';
      case 'error':
        return 'linear-gradient(45deg, #CF0000 0%, #FF5252 100%)';
      default:
        return 'linear-gradient(45deg, #C67C00 0%, #FFAB40 100%)';
    }
  };

  return (
    <MotionCard
      component={motion.div}
      variants={cardVariants}
      whileHover="hover"
      whileTap="tap"
      custom={index}
      onClick={() => handleSelectDatabase(db)}
      sx={{ 
        height: '100%',
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'rgba(26, 35, 50, 0.7)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '30%',
          height: '5px',
          background: getStatusColor(db.connection_status),
          borderRadius: '0 0 0 8px'
        }
      }}
    >
      <CardContent sx={{ 
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2
        }}>
          <MotionTypography 
            variant="h6" 
            fontWeight="bold" 
            component={motion.h6}
            animate={{ 
              color: [
                theme.palette.text.primary, 
                theme.palette.primary.light,
                theme.palette.text.primary
              ] 
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 5
            }}
            sx={{ mb: 1 }}
          >
            {db.name}
          </MotionTypography>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            borderRadius: 10,
            background: getStatusColor(db.connection_status),
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatDelay: 2 
              }}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#fff',
                  fontWeight: 'bold',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                }}
              >
                {db.connection_status?.toUpperCase() || 'UNKNOWN'}
              </Typography>
            </motion.div>
          </Box>
        </Box>
        
        <Typography variant="body2" sx={{ 
          color: alpha(theme.palette.text.secondary, 0.9),
          mb: 2,
          flexGrow: 1,
        }}>
          {db.description || `PostgreSQL Database at ${db.host}:${db.port}`}
        </Typography>
        
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 'auto',
          pt: 2,
          borderTop: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.1)
        }}>
          <Tooltip title="Query this database" arrow>
            <MotionButton
              component={motion.button}
              whileHover={{ 
                scale: 1.1,
                boxShadow: '0 0 15px rgba(124, 77, 255, 0.4)'
              }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 10
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectDatabase(db);
                handleQueryDatabase();
              }}
              variant="outlined"
              size="small"
              startIcon={<QueryStatsIcon />}
              sx={{ 
                borderRadius: 2,
                borderColor: alpha(theme.palette.primary.main, 0.5),
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  background: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              Query
            </MotionButton>
          </Tooltip>
          
          <Tooltip title="Delete database" arrow>
            <MotionIconButton 
              component={motion.button}
              whileHover={{ 
                scale: 1.1,
                boxShadow: '0 0 15px rgba(255, 82, 82, 0.4)'
              }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 10
              }}
              edge="end" 
              aria-label="delete" 
              onClick={(event) => openDeleteDialog(db, event)}
              color="error"
              sx={{
                '&:hover': {
                  background: alpha(theme.palette.error.main, 0.1)
                }
              }}
            >
              <DeleteIcon />
            </MotionIconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </MotionCard>
  );
};

export default DatabaseCard;
