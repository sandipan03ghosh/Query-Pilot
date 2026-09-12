import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../api";
import { REFRESH_TOKEN, ACCESS_TOKEN } from "../constants";
import { useState, useEffect } from "react";
import { Box, CircularProgress, Typography, Alert, Button } from "@mui/material";
import { Link } from "react-router-dom";

function ProtectedRoute({ children }) {
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        auth().catch((err) => {
            console.error("Authentication error:", err);
            setError(err.message || "Authentication failed");
            setIsAuthorized(false);
        })
    }, [])

    const refreshToken = async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN);
        if (!refreshToken) {
            setError("No refresh token found");
            setIsAuthorized(false);
            return;
        }
        
        try {
            const res = await api.post("/api/token/refresh/", {
                refresh: refreshToken,
            });
            if (res.status === 200) {
                localStorage.setItem(ACCESS_TOKEN, res.data.access)
                setIsAuthorized(true)
            } else {
                setError(`Refresh token error: ${res.status}`);
                setIsAuthorized(false)
            }
        } catch (error) {
            console.error("Token refresh error:", error);
            setError(error.message || "Failed to refresh authentication token");
            setIsAuthorized(false);
        }
    };

    const auth = async () => {
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
            setIsAuthorized(false);
            return;
        }
        
        try {
            const decoded = jwtDecode(token);
            const tokenExpiration = decoded.exp;
            const now = Date.now() / 1000;

            if (tokenExpiration < now) {
                await refreshToken();
            } else {
                setIsAuthorized(true);
            }
        } catch (decodeError) {
            console.error("Token decode error:", decodeError);
            setError("Invalid token format");
            setIsAuthorized(false);
        }
    };

    if (isAuthorized === null) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100vh',
                    bgcolor: 'background.default',
                    color: 'text.primary'
                }}
            >
                <CircularProgress size={60} color="primary" />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    Authenticating...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100vh',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    p: 3
                }}
            >
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => {
                        localStorage.removeItem(ACCESS_TOKEN);
                        localStorage.removeItem(REFRESH_TOKEN);
                    }}
                    component={Link}
                    to="/login"
                >
                    Return to Login
                </Button>
            </Box>
        );
    }

    return isAuthorized ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
