import { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/Home.css";
import { 
  Box,
  Typography,
  IconButton,
  Fade,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingIndicator from "../components/LoadingIndicator";
import Navbar from "../components/Navbar";
import PopupResult from "../components/PopupResult";

// Import our custom component files
import Sidebar from "../components/home/Sidebar";
import MobileHeader from "../components/home/MobileHeader";
import SessionMessages from "../components/home/SessionMessages";
import QueryInput from "../components/home/QueryInput";

function Home() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { sessionId } = useParams();
    const navigate = useNavigate();
    
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [generatedSql, setGeneratedSql] = useState("");
    const [showSqlControls, setShowSqlControls] = useState(false);
    const [showResultPopup, setShowResultPopup] = useState(false);
    const [queryResult, setQueryResult] = useState(null);
    const [queryAnalysis, setQueryAnalysis] = useState(null); // {confidence, verification, guardrailWarnings}
    const [clarification, setClarification] = useState(null);  // {interpretations:[...]} | null
    const [currentNaturalQuery, setCurrentNaturalQuery] = useState("");
    const [historicQueryData, setHistoricQueryData] = useState(null);
    const [currentQueryId, setCurrentQueryId] = useState(null); // To track the current query being processed
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    
    // Session management states
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [currentSession, setCurrentSession] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [database, setDatabase] = useState(null);

    // Sidebar width for calculations
    const sidebarWidth = 320;
    
    // Load the session data based on sessionId from URL
    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId) {
                navigate('/sessions');
                return;
            }
            
            setInitialLoading(true);
            try {
                const sessionResponse = await api.getSession(sessionId);
                const sessionData = sessionResponse.data;
                
                // Set the session
                setCurrentSession(sessionData);
                setCurrentSessionId(sessionId);
                
                // Load database data if database_id exists
                if (sessionData.database_id) {
                    try {
                        const dbResponse = await api.getDatabase(sessionData.database_id);
                        setDatabase(dbResponse.data);
                    } catch (err) {
                        console.error("Error loading database:", err);
                    }
                }
            } catch (error) {
                console.error("Error loading session:", error);
                // Show an error message to the user
                alert("Failed to load session. The session may not exist or you don't have permission to access it.");
                // Redirect to sessions page
                navigate('/sessions');
            } finally {
                setInitialLoading(false);
            }
        };
        
        loadSessionData();
    }, [sessionId, navigate]);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        scrollToBottom();
    }, [currentSession]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load a specific session by ID
    const loadSession = async (sessionId) => {
        if (!sessionId) return;
        
        setInitialLoading(true);
        try {
            const sessionResponse = await api.getSession(sessionId);
            setCurrentSessionId(sessionId);
            setCurrentSession(sessionResponse.data);
            
            // If there are queries in this session, set the most recent response
            const queries = sessionResponse.data.queries;
            
            // Console log all historical queries
            console.log("Historical queries loaded:", queries);
            
            if (queries && queries.length > 0) {
                setResponse(queries[queries.length - 1].response);
            } else {
                setResponse("");
            }
            
            if (isMobile) {
                setDrawerOpen(false); // Close the drawer after selection only on mobile
            }
        } catch (error) {
            console.error("Error loading session:", error);
        } finally {
            setInitialLoading(false);
        }
    };

    // Run one natural-language question through the combined backend pipeline
    // (/api/llm/query/): generate -> guardrails -> execute -> verify -> confidence.
    // The backend logs the Query row itself; the client just reloads history and
    // shows the result popup with the confidence / verification summary.
    const runNaturalQuery = async (text) => {
        if (!text.trim() || !currentSessionId) return;

        setLoading(true);
        setClarification(null);
        try {
            const sessionResponse = await api.getSession(currentSessionId);
            const databaseId = sessionResponse.data.database_id;
            if (!databaseId) throw new Error("No database associated with this session");

            const { data } = await api.runQuery(text, databaseId, {
                sessionId: currentSessionId,
            });

            setCurrentNaturalQuery(text);
            setQuery("");

            if (data.needs_clarification) {
                setClarification({
                    question: text,
                    interpretations: data.interpretations || [],
                });
                return;
            }

            if (data.answerable === false) {
                setResponse(
                    data.message ||
                        "This question can't be answered from the available schema."
                );
                loadSession(currentSessionId);
                return;
            }

            setGeneratedSql(data.sql_query || "");
            setShowSqlControls(false);
            setQueryResult(data.results || null);
            setQueryAnalysis({
                confidence: data.confidence || null,
                verification: data.verification || null,
                guardrailWarnings: data.guardrail_warnings || [],
            });
            setCurrentQueryId(data.query_id || null);
            setShowResultPopup(true);
            loadSession(currentSessionId);
        } catch (error) {
            console.error("Error running query:", error);

            let errorMessage = "An error occurred while running the query.";
            if (error.response?.data?.error) {
                errorMessage = `Error: ${error.response.data.error}`;
            } else if (error.response?.data?.detail) {
                errorMessage = `Error: ${error.response.data.detail}`;
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }

            await api.addQueryToSession(
                currentSessionId,
                text,
                errorMessage,
                false,
                "QUERY_PIPELINE_ERROR",
                errorMessage,
                null,
                null
            );
            setResponse(errorMessage);
            loadSession(currentSessionId);
            setQuery("");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        runNaturalQuery(query);
    };

    // User picked one reading of an ambiguous question — re-run it, disambiguated.
    const pickInterpretation = (interp) => {
        const base = clarification?.question || currentNaturalQuery || "";
        const label = interp?.label ? ` — ${interp.label}` : "";
        runNaturalQuery(`${base}${label}`);
    };
    
    // Execute the generated SQL query
    const executeGeneratedSql = async () => {
        if (!generatedSql || !currentSessionId) return;
        
        setLoading(true);
        try {
            // Get the database ID from the current session
            const sessionResponse = await api.getSession(currentSessionId);
            const databaseId = sessionResponse.data.database_id;
            
            // Execute the generated SQL
            console.log("Executing SQL on database ID:", databaseId);
            const executionResponse = await api.executeSqlQuery(databaseId, generatedSql);
            
            console.log("Query execution success:", executionResponse.data.success);
            
            // Store the query results
            setQueryResult(executionResponse.data);
            
            // Format the response to display the generated SQL and the results
            const formattedResponse = `
**Generated SQL:**
\`\`\`
${generatedSql}
\`\`\`

**Results:**
${formatQueryResults(executionResponse.data)}
`;

            if (currentQueryId) {
                // Update the existing query with the execution results
                await api.updateQuery(currentSessionId, currentQueryId, {
                    response: formattedResponse, 
                    success: executionResponse.data.success,
                    error_type: executionResponse.data.success ? null : "SQL_EXECUTION_ERROR",
                    error: executionResponse.data.success ? null : executionResponse.data.status,
                    generated_sql: generatedSql
                });
                
                // Reset currentQueryId as we've completed the process
                setCurrentQueryId(null);
            } else {
                // If no currentQueryId exists, create a new query with all fields
                await api.addQueryToSession(
                    currentSessionId, 
                    currentNaturalQuery, 
                    formattedResponse,
                    executionResponse.data.success,
                    executionResponse.data.success ? null : "SQL_EXECUTION_ERROR",
                    executionResponse.data.success ? null : executionResponse.data.status,
                    generatedSql
                );
            }
            
            // Update the local state to show the response
            setResponse(formattedResponse);
            
            // Show the result popup
            setShowResultPopup(true);
            
            // Reset the SQL controls
            setShowSqlControls(false);
            
            // Reload the session to get the updated queries
            loadSession(currentSessionId);
        } catch (error) {
            console.error("Error executing query:", error);
            
            // Create an error message that's user-friendly
            let errorMessage = "An error occurred while executing the SQL query.";
            let errorType = "SQL_EXECUTION_ERROR";
            let errorDetail = error.message || "Unknown error";
            
            if (error.response) {
                if (error.response.data && error.response.data.detail) {
                    errorDetail = error.response.data.detail;
                    errorMessage = `Error: ${errorDetail}`;
                } else if (error.response.data && error.response.data.error) {
                    errorDetail = error.response.data.error;
                    errorMessage = `Error: ${errorDetail}`;
                } else {
                    errorDetail = `${error.response.status} - ${error.response.statusText}`;
                    errorMessage = `Error: ${errorDetail}`;
                }
            }
            
            // Format the error response
            const formattedResponse = `
**Generated SQL:**
\`\`\`
${generatedSql}
\`\`\`

**Error:**
${errorMessage}
`;
            
            if (currentQueryId) {
                // Update the existing query with the error information
                await api.updateQuery(currentSessionId, currentQueryId, {
                    response: formattedResponse,
                    success: false,
                    error_type: errorType,
                    error: errorDetail,
                    generated_sql: generatedSql
                });
                
                // Reset currentQueryId since we've completed the process
                setCurrentQueryId(null);
            } else {
                // If no currentQueryId exists, create a new query with all fields
                await api.addQueryToSession(
                    currentSessionId,
                    currentNaturalQuery || query,
                    formattedResponse,
                    false,
                    errorType,
                    errorDetail,
                    generatedSql
                );
            }
            
            // Update the local state to show the error
            setResponse(formattedResponse);
            
            // Reset the SQL controls
            setShowSqlControls(false);
            
            // Reload the session to get the updated queries
            loadSession(currentSessionId);
        } finally {
            setLoading(false);
        }
    };
    
    // Discard the generated SQL
    const discardGeneratedSql = () => {
        setGeneratedSql("");
        setShowSqlControls(false);
    };
    
    // Copy text to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                // console.log("Text copied to clipboard");
            })
            .catch(err => {
                console.error("Could not copy text: ", err);
            });
    };
    
    // Helper function to clean SQL query by removing markdown code block markers
    const cleanSqlQuery = (sql) => {
        if (!sql) return sql;
        return sql.replace(/```sql\s*/g, '').replace(/```\s*$/g, '').replace(/^```\s*/g, '').replace(/\s*```$/g, '').trim();
    };

    // Helper function to generate a compact summary of query results
    const generateResultsSummary = (responseText) => {
        if (!responseText) return { previewText: "No results available", rowCount: 0 };
        
        // Parse the results from markdown
        const { sql, results } = parseResultsFromMarkdown(responseText);
        
        // If there's an error or no results
        if (!results || !results.success) {
            const errorMatch = responseText.match(/Query failed:\s*(.*)/);
            const errorMessage = errorMatch ? errorMatch[1].trim() : "Query failed";
            return { previewText: errorMessage, rowCount: 0, hasError: true };
        }
        
        // If there are no rows
        if (!results.rows || results.rows.length === 0) {
            return { previewText: "Query executed successfully. No records found.", rowCount: 0 };
        }
        
        // Get row count
        const rowCount = results.rows.length;
        
        // Generate a more detailed preview with column names and values from first few rows
        let previewText = "";
        
        // Show SQL preview first (truncated)
        if (sql) {
            const sqlPreview = sql.length > 70 ? sql.substring(0, 70) + "..." : sql;
            previewText += `SQL: ${sqlPreview}\n\n`;
        }
        
        // Add row count information
        previewText += `Results: ${rowCount} ${rowCount === 1 ? 'row' : 'rows'} returned\n\n`;
        
        // Show column headers (up to 4)
        const maxColumnsToShow = Math.min(4, results.columns.length);
        const columnHeaders = results.columns.slice(0, maxColumnsToShow);
        if (results.columns.length > maxColumnsToShow) {
            columnHeaders.push("...");
        }
        previewText += `${columnHeaders.join(" | ")}\n`;
        
        // Show first 2 rows of data
        const rowsToShow = Math.min(2, results.rows.length);
        for (let i = 0; i < rowsToShow; i++) {
            const rowValues = results.rows[i].slice(0, maxColumnsToShow).map(val => 
                val === null ? 'NULL' : String(val).length > 15 ? String(val).substring(0, 15) + "..." : String(val)
            );
            
            if (results.columns.length > maxColumnsToShow) {
                rowValues.push("...");
            }
            
            previewText += `${rowValues.join(" | ")}\n`;
        }
        
        // If there are more rows, indicate it
        if (results.rows.length > 2) {
            previewText += `... and ${results.rows.length - 2} more rows`;
        }
        
        return { previewText, rowCount, sql };
    };

    // Helper function to format query results for display
    const formatQueryResults = (results) => {
        // console.log("Formatting query results:", results);
        
        if (!results) {
            // console.log("Results is null or undefined");
            return "No results available.";
        }
        
        if (!results.success) {
            // console.log("Query execution reported failure:", results.status);
            return `Query failed: ${results.status}`;
        }
        
        if (!results.rows || results.rows.length === 0) {
            // console.log("No rows in results");
            return "No results found.";
        }
        
        // console.log("Processing rows:", results.rows);
        // console.log("Column headers:", results.columns);
        
        // Create a table header from columns
        const headers = results.columns;
        
        // Format as markdown table
        let tableMarkdown = `| ${headers.join(' | ')} |\n`;
        tableMarkdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
        
        // Add table rows
        results.rows.forEach(row => {
            // console.log("Processing row:", row);
            tableMarkdown += `| ${row.map(cell => (cell === null ? 'NULL' : String(cell).replace(/\n/g, ' '))).join(' | ')} |\n`;
        });
        
        // console.log("Generated markdown table:", tableMarkdown);
        return tableMarkdown;
    };

    // Helper function to extract SQL from previous response markdown
    const extractSqlFromMarkdown = (responseText) => {
        if (!responseText) return '';
        
        // Look for SQL code block
        const sqlBlockRegex = /```(?:sql)?\s*([\s\S]*?)```/;
        const match = responseText.match(sqlBlockRegex);
        
        if (match && match[1]) {
            return match[1].trim();
        }
        
        return '';
    };
    
    // Helper function to parse previous query results from markdown
    const parseResultsFromMarkdown = (responseText) => {
        if (!responseText) return null;
        
        // Extract SQL
        const sql = extractSqlFromMarkdown(responseText);
        
        // Create a mock result object that matches the expected structure
        const mockResult = {
            success: true,
            columns: [],
            rows: [],
            execution_time: null
        };
        
        // Try to find the results section
        const resultsRegex = /\*\*Results:\*\*([\s\S]*?)(?:$|(?:\n\n))/;
        const resultsMatch = responseText.match(resultsRegex);
        
        if (resultsMatch && resultsMatch[1]) {
            const resultsText = resultsMatch[1].trim();
            
            // Check for error messages
            if (resultsText.includes('Query failed:') || resultsText.includes('No results')) {
                mockResult.success = false;
                mockResult.status = resultsText.replace('Query failed:', '').trim();
                return { sql, results: mockResult };
            }
            
            // Try to parse markdown table
            const tableRegex = /\|\s*(.*?)\s*\|\n\|\s*[-:\s|]*\|\n([\s\S]*)/;
            const tableMatch = resultsText.match(tableRegex);
            
            if (tableMatch) {
                // Parse headers
                mockResult.columns = tableMatch[1].split('|').map(header => header.trim());
                
                // Parse rows
                const rowsText = tableMatch[2];
                const rowLines = rowsText.split('\n').filter(line => line.trim().startsWith('|'));
                
                mockResult.rows = rowLines.map(line => {
                    // Remove first and last | and split by |
                    const cells = line.trim()
                        .substring(1, line.length - 1)
                        .split('|')
                        .map(cell => {
                            const trimmed = cell.trim();
                            return trimmed === 'NULL' ? null : trimmed;
                        });
                    
                    return cells;
                });
                
                return { sql, results: mockResult };
            }
        }
        
        return { sql, results: null };
    };
    
    // Show a previous query's results in the popup
    const showPreviousQueryResults = (item) => {
        // console.log("Showing previous query results:", item);
        
        // Parse response text from markdown to extract SQL and results
        const { sql, results } = parseResultsFromMarkdown(item.response);
        
        // Create a comprehensive result object that includes all fields we need
        const enhancedResults = {
            ...(results || {}),
            // Include success status from the query object
            success: item.success,
            // Include error information if present
            error_type: item.error_type,
            error: item.error,
            // Include generated SQL and explanation
            explanation: item.explanation
        };
        
        // Set up the data for the popup
        setHistoricQueryData({
            sql: item.generated_sql || sql, // Prefer the stored generated_sql if available
            results: enhancedResults,
            naturalQuery: item.prompt  // The original natural language query
        });
        
        // Show the popup
        setShowResultPopup(true);
    };

    // 👍 / 👎 on a generated query — feeds the promote_feedback flywheel.
    const submitFeedback = async (queryId, value) => {
        if (!currentSessionId) return;
        try {
            await api.submitQueryFeedback(currentSessionId, queryId, value);
            loadSession(currentSessionId);
        } catch (error) {
            console.error("Error submitting feedback:", error);
        }
    };

    // Delete a query and its response from the session
    const handleDeleteQuery = async (queryId) => {
        if (!currentSessionId) return;
        
        try {
            await api.deleteQueryFromSession(currentSessionId, queryId);
            
            // Update the current session by reloading it
            loadSession(currentSessionId);
        } catch (error) {
            console.error("Error deleting query:", error);
        }
    };

    if (initialLoading) {
        return (
            <>
                <Navbar />
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '80vh', 
                    bgcolor: 'background.default',
                }}>
                    <Fade in={true} style={{ transitionDelay: '300ms' }}>
                        <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center',
                            p: 3,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.background.paper, 0.6),
                            backdropFilter: 'blur(8px)',
                        }}>
                            <LoadingIndicator size={40} />
                            <Typography variant="h6" sx={{ mt: 2, color: 'text.primary', fontWeight: 500 }}>
                                Loading your session...
                            </Typography>
                        </Box>
                    </Fade>
                </Box>
            </>
        );
    }

    return (
        <Box sx={{ 
            width: '100%',
            height: '100vh',
            maxWidth: '100vw',
            overflowX: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Navbar />
            <Box sx={{ 
                pt: 2, 
                px: 3, 
                bgcolor: theme.palette.background.paper, 
                backgroundImage: 'linear-gradient(rgba(30, 36, 50, 0.8), rgba(21, 26, 37, 0.9))',
                borderBottom: '1px solid', 
                borderColor: 'divider', 
                zIndex: 50 
            }}>
                <Box display="flex" alignItems="center">
                    <IconButton 
                        onClick={() => navigate('/sessions', { state: { database: { id: currentSession?.database_id, name: currentSession?.database_name } } })} 
                        color="primary" 
                        aria-label="back to sessions" 
                        sx={{ 
                            mr: 2,
                            '&:hover': {
                                background: alpha(theme.palette.primary.main, 0.1),
                            }
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h5" component="h1" fontWeight={600} sx={{
                        background: 'linear-gradient(45deg, #6596EB, #BB86FC)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        {currentSession?.title || "Chat Session"}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ 
                display: 'flex', 
                height: 'calc(100vh - 128px)', 
                bgcolor: 'background.default',
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(30, 36, 50, 0.1) 0%, rgba(21, 26, 37, 0.5) 100%)',
            }}>
                {/* Sidebar - For desktop */}
                {!isMobile && (
                    <Sidebar
                        sidebarWidth={sidebarWidth}
                        currentSessionId={currentSessionId}
                        loadSession={loadSession}
                        currentSession={currentSession}
                    />
                )}

                {/* Main content area */}
                <Box 
                    sx={{ 
                        flexGrow: 1, 
                        marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
                        width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Mobile header and drawer */}
                    {isMobile && (
                        <MobileHeader
                            currentSession={currentSession}
                            drawerOpen={drawerOpen}
                            setDrawerOpen={setDrawerOpen}
                            sidebarWidth={sidebarWidth}
                            currentSessionId={currentSessionId}
                            loadSession={loadSession}
                        />
                    )}
                    
                    {/* Messages area */}
                    <SessionMessages
                        ref={messagesContainerRef}
                        currentSession={currentSession}
                        messagesEndRef={messagesEndRef}
                        showSqlControls={showSqlControls}
                        generatedSql={generatedSql}
                        copyToClipboard={copyToClipboard}
                        discardGeneratedSql={discardGeneratedSql}
                        executeGeneratedSql={executeGeneratedSql}
                        generateResultsSummary={generateResultsSummary}
                        showPreviousQueryResults={showPreviousQueryResults}
                        handleDeleteQuery={handleDeleteQuery}
                        onFeedback={submitFeedback}
                    />
                    
                    {/* Query input component */}
                    <QueryInput
                        query={query}
                        setQuery={setQuery}
                        loading={loading}
                        currentSessionId={currentSessionId}
                        handleSubmit={handleSubmit}
                        isMobile={isMobile}
                        sidebarWidth={sidebarWidth}
                    />
                </Box>
            </Box>
            
            {/* Clarification prompt for an ambiguous question */}
            {clarification && (
                <Box sx={{
                    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1300, width: 'min(640px, 92vw)',
                    bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                    borderRadius: 2, p: 2, boxShadow: 6,
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                            That question has a few readings — which did you mean?
                        </Typography>
                        <IconButton size="small" onClick={() => setClarification(null)}>
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {clarification.interpretations.map((interp, i) => (
                            <Box
                                key={i}
                                onClick={() => pickInterpretation(interp)}
                                role="button"
                                sx={{
                                    p: 1.25, borderRadius: 1, cursor: 'pointer',
                                    border: '1px solid', borderColor: 'divider',
                                    '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                }}
                            >
                                <Typography variant="body2" fontWeight={600}>{interp.label}</Typography>
                                {interp.explanation && (
                                    <Typography variant="caption" color="text.secondary">
                                        {interp.explanation}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Results Popup - Show when query results are available */}
            <PopupResult
                open={showResultPopup}
                onClose={() => {
                    setShowResultPopup(false);
                    setHistoricQueryData(null);  // Clear historic data when closing
                    setQueryAnalysis(null);
                }}
                sql={historicQueryData ? historicQueryData.sql : generatedSql}
                results={historicQueryData ? historicQueryData.results : queryResult}
                executionTime={historicQueryData ? null : queryResult?.execution_time}
                naturalQuery={historicQueryData ? historicQueryData.naturalQuery : currentNaturalQuery}
                confidence={historicQueryData ? null : queryAnalysis?.confidence}
                verification={historicQueryData ? null : queryAnalysis?.verification}
                guardrailWarnings={historicQueryData ? null : queryAnalysis?.guardrailWarnings}
            />
        </Box>
    );
}

export default Home;