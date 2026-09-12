import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './styles/index.css'
import { motion } from 'framer-motion'

// Create a custom motion component that can be used throughout the app
const MotionDiv = motion.div;

// Create a theme instance with professional dark mode
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2E8B57', // Sea green as primary color
      light: '#3CB371',
      dark: '#1D6A42',
    },
    secondary: {
      main: '#0D7DCE', // Vibrant blue as secondary color
      light: '#1E90FF',
      dark: '#0056A4',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#ED6C02',
      light: '#FF9800',
      dark: '#E65100',
    },
    info: {
      main: '#0288D1',
      light: '#03A9F4',
      dark: '#01579B',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    background: {
      default: '#0F0F0F', // Darker grey/black background
      paper: '#1A1A1A', // Slightly lighter grey
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0', // Grey for secondary text
    },
    divider: 'rgba(255, 255, 255, 0.09)',
  },
  typography: {
    fontFamily: [
      'Inter',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      'Open Sans',
      'Helvetica Neue',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
    subtitle1: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 2, // Further reduced border radius for more rectangular corners
  },
  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(46, 139, 87, 0.08), rgba(13, 125, 206, 0.06))',
          backgroundAttachment: 'fixed',
          backgroundSize: '100% 100%',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(46, 139, 87, 0.3)',
            borderRadius: '2px',
            '&:hover': {
              backgroundColor: 'rgba(46, 139, 87, 0.5)',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
              transition: 'border-color 0.2s ease-in-out',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2E8B57',
              borderWidth: 2,
            },
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transform: 'translateY(-1px)',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.15)',
            },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            transition: 'color 0.2s ease',
            '&.Mui-focused': {
              color: '#3CB371',
            },
          },
          '& .MuiOutlinedInput-input': {
            color: '#fff',
          },
          marginBottom: '16px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(26, 26, 26, 0.8)',
          backgroundImage: 'linear-gradient(180deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0.9) 100%)',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(15px)',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          '&:hover': {
            boxShadow: '0 4px 15px rgba(46, 139, 87, 0.15), 0 3px 8px rgba(13, 125, 206, 0.1)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          letterSpacing: '0.3px',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.12)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(-2px)',
          },
          '&:active': {
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(0)',
          },
        },
        contained: {
          '&.MuiButton-containedPrimary': {
            background: 'linear-gradient(45deg, #1D6A42 10%, #2E8B57 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #2E8B57 10%, #3CB371 90%)',
            },
          },
          '&.MuiButton-containedSecondary': {
            background: 'linear-gradient(45deg, #0056A4 10%, #0D7DCE 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #0D7DCE 10%, #1E90FF 90%)',
            },
          },
          '&.MuiButton-containedSuccess': {
            background: 'linear-gradient(45deg, #1B5E20 10%, #2E7D32 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #2E7D32 10%, #4CAF50 90%)',
            },
          },
          '&.MuiButton-containedError': {
            background: 'linear-gradient(45deg, #C62828 10%, #D32F2F 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #D32F2F 10%, #EF5350 90%)',
            },
          },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': {
            borderWidth: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '&.MuiButton-outlinedPrimary': {
            borderColor: 'rgba(46, 139, 87, 0.5)',
            boxShadow: '0 0 5px rgba(46, 139, 87, 0.1)',
            '&:hover': {
              borderColor: 'rgba(46, 139, 87, 0.8)',
              boxShadow: '0 0 8px rgba(46, 139, 87, 0.2)',
            },
          },
          '&.MuiButton-outlinedSecondary': {
            borderColor: 'rgba(13, 125, 206, 0.5)',
            boxShadow: '0 0 5px rgba(13, 125, 206, 0.1)',
            '&:hover': {
              borderColor: 'rgba(13, 125, 206, 0.8)',
              boxShadow: '0 0 8px rgba(13, 125, 206, 0.2)',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(26, 26, 26, 0.7)',
          backgroundImage: 'linear-gradient(160deg, rgba(26, 26, 26, 0.7) 0%, rgba(15, 15, 15, 0.8) 100%)',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(15px)',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.04)',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            boxShadow: '0 5px 15px rgba(46, 139, 87, 0.15), 0 3px 8px rgba(13, 125, 206, 0.1)',
            transform: 'translateY(-2px)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-50%',
            width: '200%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(46, 139, 87, 0.5), rgba(13, 125, 206, 0.5), transparent)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::after': {
            opacity: 1,
          },
        },
      },
    },
  },
});

// Export the theme and MotionDiv for use in other components
export { theme, MotionDiv };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
