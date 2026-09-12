import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Alert,
  CircularProgress 
} from '@mui/material';
import api from '../../api';

const DatabaseConnectionForm = ({ onDatabaseAdded, darkTheme }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    database_type: "postgresql",
    host: "localhost",
    port: 5432,
    database_name: "",
    username: "",
    password: "",
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "port" ? parseInt(value, 10) || "" : value,
    });
  };

  // Function to show snackbar notification
  const showSnackbar = (message, severity) => {
    // Pass notification up to parent component
    if (onDatabaseAdded) {
      onDatabaseAdded({ message, severity });
    }
  };

  // Handle database creation
  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.post("/api/databases/databases/", formData);
      
      // Reset form after successful creation
      setFormData({
        name: "",
        description: "",
        database_type: "postgresql",
        host: "localhost",
        port: 5432,
        database_name: "",
        username: "",
        password: "",
      });
      setError(null);
      
      showSnackbar("Database added successfully!", "success");
      
      // Notify parent component about the new database
      if (onDatabaseAdded) {
        onDatabaseAdded({ 
          success: true, 
          database: response.data 
        });
      }
    } catch (err) {
      setError("Failed to create database. Please check your inputs.");
      showSnackbar("Failed to create database", "error");
      console.error("Error creating database:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper className="p-6 rounded-lg shadow-md" sx={{ 
      background: 'linear-gradient(135deg, #1F2736 0%, #1A2332 100%)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid rgba(124, 77, 255, 0.3)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '6px',
        background: 'linear-gradient(90deg, #7C4DFF, #03DAC6, #FF5252, #FFB74D)',
        backgroundSize: '300% 100%',
        animation: 'gradient-animation 4s ease infinite',
      },
      '@keyframes gradient-animation': {
        '0%': { backgroundPosition: '0% 50%' },
        '50%': { backgroundPosition: '100% 50%' },
        '100%': { backgroundPosition: '0% 50%' }
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at bottom right, rgba(124, 77, 255, 0.15), transparent 50%)',
        pointerEvents: 'none',
      },
    }}>
      <Typography variant="h5" className="mb-4 font-semibold" sx={{
        background: 'linear-gradient(90deg, #7C4DFF, #03DAC6)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 600,
        letterSpacing: '0.5px',
        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        Add Database Connection
      </Typography>
      
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}
      
      <form onSubmit={handleCreateDatabase} className="space-y-4">
        <TextField
          label="Name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          fullWidth
          required
          variant="outlined"
          InputLabelProps={{
            style: { color: '#03DAC6' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(31, 39, 54, 0.6)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(124, 77, 255, 0.25)'
              },
              '&.Mui-focused': {
                boxShadow: '0 0 0 2px rgba(124, 77, 255, 0.4)'
              }
            }
          }}
        />
        
        <TextField
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          InputLabelProps={{
            style: { color: '#03DAC6' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(31, 39, 54, 0.6)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(124, 77, 255, 0.25)'
              },
              '&.Mui-focused': {
                boxShadow: '0 0 0 2px rgba(124, 77, 255, 0.4)'
              }
            }
          }}
        />
        
        <Box className="grid grid-cols-2 gap-4">
          <TextField
            label="Host"
            name="host"
            value={formData.host}
            onChange={handleInputChange}
            fullWidth
            required
            variant="outlined"
            InputLabelProps={{
              style: { color: '#7C4DFF' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(31, 39, 54, 0.6)',
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(124, 77, 255, 0.25)'
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 2px rgba(124, 77, 255, 0.4)'
                }
              }
            }}
          />
          
          <TextField
            label="Port"
            name="port"
            type="number"
            value={formData.port}
            onChange={handleInputChange}
            fullWidth
            required
            variant="outlined"
            InputLabelProps={{
              style: { color: '#7C4DFF' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(31, 39, 54, 0.6)',
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(124, 77, 255, 0.25)'
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 2px rgba(124, 77, 255, 0.4)'
                }
              }
            }}
          />
        </Box>
        
        <TextField
          label="Database Name"
          name="database_name"
          value={formData.database_name}
          onChange={handleInputChange}
          fullWidth
          required
          variant="outlined"
          InputLabelProps={{
            style: { color: '#03DAC6' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(31, 39, 54, 0.6)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(3, 218, 198, 0.25)'
              },
              '&.Mui-focused': {
                boxShadow: '0 0 0 2px rgba(3, 218, 198, 0.4)'
              }
            }
          }}
        />
        
        <TextField
          label="Username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          fullWidth
          required
          variant="outlined"
          InputLabelProps={{
            style: { color: '#FFB74D' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(31, 39, 54, 0.6)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(255, 183, 77, 0.25)'
              },
              '&.Mui-focused': {
                boxShadow: '0 0 0 2px rgba(255, 183, 77, 0.4)'
              }
            }
          }}
        />
        
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleInputChange}
          fullWidth
          required
          variant="outlined"
          InputLabelProps={{
            style: { color: '#FF5252' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(31, 39, 54, 0.6)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(255, 82, 82, 0.25)'
              },
              '&.Mui-focused': {
                boxShadow: '0 0 0 2px rgba(255, 82, 82, 0.4)'
              }
            }
          }}
        />
        
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          className="py-3"
          sx={{
            background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
            backgroundSize: '200% 100%',
            transition: 'all 0.3s ease',
            marginTop: '24px',
            height: '48px',
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '16px',
            boxShadow: '0 4px 10px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              backgroundPosition: 'right center',
              boxShadow: '0 6px 15px rgba(124, 77, 255, 0.4)',
              transform: 'translateY(-3px)'
            }
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Add Database"}
        </Button>
      </form>
    </Paper>
  );
};

export default DatabaseConnectionForm;