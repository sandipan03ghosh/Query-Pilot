import { useState, useEffect } from 'react';
import { 
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  alpha,
  Tooltip,
  Badge
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Storage as StorageIcon,
  QueryStats as QueryStatsIcon,
  Description as DescriptionIcon,
  AccountCircle as AccountCircleIcon,
  Dashboard as DashboardIcon,
  Insights as InsightsIcon,
  Hub as HubIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { ACCESS_TOKEN } from '../constants';
import api from '../api';
import { motion } from 'framer-motion';
import { MotionDiv } from '../main';

// Create motion components
const MotionBox = motion(Box);
const MotionIconButton = motion(IconButton);
const MotionTypography = motion(Typography);
const MotionAppBar = motion(AppBar);
const MotionButton = motion(Button);
const MotionAvatar = motion(Avatar);

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [username, setUsername] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Check if current route matches the given path
  const isActive = (path) => location.pathname === path;
  
  // Navigation items
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { name: 'Databases', path: '/databases', icon: <StorageIcon /> },
    { name: 'Metadata Manager', path: '/db-tester', icon: <DashboardIcon /> },
    { name: 'Evaluation', path: '/model-monitoring', icon: <InsightsIcon /> },
    { name: 'Semantic Graph', path: '/semantic-graph', icon: <HubIcon /> }
  ];
  
  // Fetch username on component mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // Try to get username from JWT token
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (token) {
          // Decode the token to get user information
          const decoded = jwtDecode(token);
          if (decoded.username) {
            setUsername(decoded.username);
            return;
          }
        }
        
        // If we can't get it from the token, fetch from API
        const response = await api.get('/api/user/me/');
        if (response.data && response.data.username) {
          setUsername(response.data.username);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };
    
    fetchUserInfo();
  }, []);
  
  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleMenuClose();
    navigate('/logout');
  };
  
  const handleNavigate = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };
  
  // Mobile drawer content
  const drawer = (
    <Box sx={{ 
      width: 280, 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      background: 'linear-gradient(180deg, rgba(26, 35, 50, 0.97) 0%, rgba(18, 26, 41, 0.98) 100%)',
      backdropFilter: 'blur(20px)'
    }}>
      <MotionBox 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        sx={{ 
          p: 2.5, 
          display: 'flex', 
          alignItems: 'center', 
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.15),
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.4)} 0%, ${alpha(theme.palette.background.paper, 0.2)} 100%)`,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}
      >
        <MotionTypography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
            backgroundSize: '200% auto',
            animation: 'gradient-text-animation 4s infinite linear',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            '@keyframes gradient-text-animation': {
              '0%': { backgroundPosition: '0% center' },
              '100%': { backgroundPosition: '200% center' },
            }
          }}
        >
          LLM Query System
        </MotionTypography>
      </MotionBox>
      
      <List sx={{ flexGrow: 1, px: 1.5, py: 3 }}>
        {navItems.map((item, index) => (
          <MotionBox
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: index * 0.1 + 0.2,
              ease: [0.4, 0, 0.2, 1]
            }}
            whileHover={{ x: 5 }}
          >
            <ListItem disablePadding sx={{ mb: 1.5 }}>
              <ListItemButton 
                onClick={() => handleNavigate(item.path)}
                selected={isActive(item.path)}
                sx={{ 
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  py: 1.2,
                  overflow: 'hidden',
                  position: 'relative',
                  '&::before': isActive(item.path) ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: 'linear-gradient(180deg, #7C4DFF 0%, #03DAC6 100%)',
                    borderRadius: '0 4px 4px 0',
                  } : {},
                  '&.Mui-selected': {
                    bgcolor: 'rgba(124, 77, 255, 0.08)',
                    '&:hover': {
                      bgcolor: 'rgba(124, 77, 255, 0.16)',
                    }
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    transform: 'translateX(5px)',
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  color: isActive(item.path) ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.6),
                  minWidth: '42px',
                  transition: 'transform 0.3s ease, color 0.3s ease',
                  transform: isActive(item.path) ? 'scale(1.1)' : 'scale(1)',
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.name} 
                  primaryTypographyProps={{ 
                    fontWeight: isActive(item.path) ? 600 : 400,
                    color: isActive(item.path) ? theme.palette.primary.light : alpha(theme.palette.text.primary, 0.8),
                    letterSpacing: '0.2px',
                    transition: 'color 0.3s ease',
                  }}
                />
                {isActive(item.path) && (
                  <Box sx={{ 
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    ml: 1,
                    background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
                    boxShadow: '0 0 8px rgba(124, 77, 255, 0.5)',
                  }} />
                )}
              </ListItemButton>
            </ListItem>
          </MotionBox>
        ))}
      </List>
      
      <Box sx={{ 
        mt: 'auto', 
        p: 2, 
        borderTop: '1px solid', 
        borderColor: alpha(theme.palette.divider, 0.15),
        background: 'linear-gradient(0deg, rgba(18, 26, 41, 0.95) 0%, rgba(26, 35, 50, 0.6) 100%)',
        backdropFilter: 'blur(10px)',
      }}>
        <MotionButton
          whileHover={{ y: -3, boxShadow: '0 10px 25px rgba(124, 77, 255, 0.4)' }}
          whileTap={{ y: 1, boxShadow: '0 5px 15px rgba(124, 77, 255, 0.3)' }}
          fullWidth
          variant="outlined"
          color="primary"
          startIcon={<AccountCircleIcon />}
          onClick={() => handleNavigate('/profile')}
          sx={{ 
            mb: 2, 
            borderRadius: '12px',
            py: 1.2,
            borderWidth: '1.5px',
            borderColor: alpha(theme.palette.primary.main, 0.5),
            '&:hover': {
              borderWidth: '1.5px',
              borderColor: theme.palette.primary.main,
              boxShadow: '0 0 15px rgba(124, 77, 255, 0.3)',
            },
            justifyContent: 'flex-start',
            pl: 2,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          User Profile
        </MotionButton>
        <MotionButton
          whileHover={{ y: -3, boxShadow: '0 10px 25px rgba(124, 77, 255, 0.4)' }}
          whileTap={{ y: 1, boxShadow: '0 5px 15px rgba(124, 77, 255, 0.3)' }}
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ 
            borderRadius: '12px',
            py: 1.2,
            boxShadow: '0 4px 10px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 15px rgba(124, 77, 255, 0.4)',
            },
            justifyContent: 'flex-start',
            pl: 2,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          Logout
        </MotionButton>
      </Box>
    </Box>
  );
  
  return (
    <MotionAppBar 
      position="fixed"
      elevation={0}
      initial={{ y: 0 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 30 }}
      sx={{ 
        background: 'linear-gradient(90deg, rgba(18, 26, 41, 0.95) 0%, rgba(26, 35, 50, 0.95) 100%)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.08),
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        zIndex: theme.zIndex.drawer + 10,
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <Toolbar>
        {isMobile ? (
          <>
            <MotionIconButton
              whileHover={{ rotate: 180, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ 
                mr: 2,
                color: theme.palette.primary.light,
                transition: 'all 0.3s ease',
              }}
            >
              <MenuIcon />
            </MotionIconButton>
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              PaperProps={{
                sx: {
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
                  border: 'none',
                }
              }}
            >
              {drawer}
            </Drawer>
          </>
        ) : null}
        
        <MotionTypography 
          variant="h6" 
          component="div" 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ scale: 1.03, y: -2 }}
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            cursor: 'pointer',
            background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
            backgroundSize: '200% auto',
            animation: 'gradient-text-animation 4s infinite linear',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
            transition: 'all 0.3s ease',
            '@keyframes gradient-text-animation': {
              '0%': { backgroundPosition: '0% center' },
              '100%': { backgroundPosition: '200% center' },
            },
            '&:hover': {
              letterSpacing: '0.03em',
            }
          }}
          onClick={() => navigate('/databases')}
        >
          LLM Query System
        </MotionTypography>
        
        {/* Desktop navigation */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {navItems.map((item, index) => (
              <MotionBox
                key={item.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.1 + 0.2,
                  ease: [0.4, 0, 0.2, 1]
                }}
              >
                <Tooltip title={item.name} arrow placement="bottom">
                  <MotionButton 
                    onClick={() => handleNavigate(item.path)}
                    startIcon={item.icon}
                    whileHover={{ y: -3, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
                    whileTap={{ y: 0, boxShadow: 'none' }}
                    sx={{ 
                      mx: 1, 
                      px: 3,
                      py: 1.2,
                      color: isActive(item.path) ? theme.palette.primary.light : alpha(theme.palette.text.primary, 0.8),
                      fontWeight: isActive(item.path) ? 500 : 400,
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      '&::after': isActive(item.path) ? {
                        content: '""',
                        position: 'absolute',
                        width: '40%',
                        height: '3px',
                        background: 'linear-gradient(90deg, #7C4DFF, #03DAC6)',
                        borderRadius: '4px',
                        bottom: '6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        transition: 'all 0.3s ease',
                      } : {},
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        '&::after': isActive(item.path) ? {
                          width: '60%',
                        } : {},
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {item.name}
                  </MotionButton>
                </Tooltip>
              </MotionBox>
            ))}
          </Box>
        )}
        
        {/* User menu */}
        <MotionBox
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.4, 
            delay: 0.4,
            type: "spring", 
            stiffness: 400, 
            damping: 15 
          }}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Tooltip title="User menu" arrow placement="bottom">
            <MotionIconButton 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={handleMenuOpen}
              sx={{ 
                ml: 1,
                border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                p: 0.2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                backdropFilter: 'blur(5px)',
                boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.2)}`,
                '&:hover': {
                  border: `2px solid ${theme.palette.primary.main}`,
                  boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.4)}`,
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: theme.palette.success.main,
                      border: '2px solid black',
                      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                    }}
                  />
                }
              >
                <MotionAvatar 
                  whileHover={{ scale: 1.05 }}
                  sx={{ 
                    width: 34, 
                    height: 34, 
                    background: 'linear-gradient(135deg, #7C4DFF 0%, #03DAC6 100%)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 600
                  }}
                >
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </MotionAvatar>
              </Badge>
            </MotionIconButton>
          </Tooltip>
          
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              elevation: 5,
              sx: { 
                minWidth: 220, 
                mt: 1.5,
                background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.95) 0%, rgba(18, 26, 41, 0.98) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.08),
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #7C4DFF, #03DAC6)',
                  opacity: 1,
                }
              }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transitionDuration={300}
          >
            <Box sx={{ 
              p: 2.5, 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.1),
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <MotionAvatar
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  sx={{ 
                    width: 45, 
                    height: 45, 
                    background: 'linear-gradient(135deg, #7C4DFF 0%, #03DAC6 100%)',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                    mr: 1.5
                  }}
                >
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </MotionAvatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} letterSpacing={0.3}>
                    {username}
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: theme.palette.secondary.light,
                    display: 'flex',
                    alignItems: 'center',
                    '&::before': {
                      content: '""',
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: theme.palette.success.main,
                      mr: 0.8,
                    }
                  }}>
                    Active Session
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            <MenuItem 
              onClick={() => {
                handleMenuClose();
                navigate('/profile');
              }}
              sx={{ 
                p: 2,
                mx: 1.5,
                mt: 1.5,
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  transform: 'translateX(5px)',
                },
              }}
            >
              <AccountCircleIcon 
                fontSize="small" 
                sx={{ 
                  mr: 2,
                  color: theme.palette.primary.light
                }} 
              />
              <Typography variant="body2">User Profile</Typography>
            </MenuItem>
            
            <MenuItem 
              onClick={handleLogout}
              sx={{ 
                p: 2,
                mx: 1.5,
                my: 1.5,
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.light,
                  transform: 'translateX(5px)',
                },
              }}
            >
              <LogoutIcon 
                fontSize="small" 
                sx={{ 
                  mr: 2,
                  color: theme.palette.error.main
                }} 
              />
              <Typography variant="body2">Logout</Typography>
            </MenuItem>
          </Menu>
        </MotionBox>
      </Toolbar>
    </MotionAppBar>
  );
}

export default Navbar;