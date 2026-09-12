import { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  Box,
  Tab,
  Tabs,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  createTheme,
  ThemeProvider
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

// Import all the component panels
import DatabaseConnectionForm from "../components/database/DatabaseConnectionForm";
import DatabaseList from "../components/database/DatabaseList";
import QueryPanel, { QueryResultPanel } from "../components/database/QueryPanel";
import SchemaPanel from "../components/database/SchemaPanel";
import RelationshipsPanel from "../components/database/RelationshipsPanel";
import SearchPanel from "../components/database/SearchPanel";
import ERDiagramPanel from "../components/database/ERDiagramPanel";

// Create a dark theme for components
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7C4DFF',
    },
    secondary: {
      main: '#03DAC6',
    },
    error: {
      main: '#FF5252',
    },
    warning: {
      main: '#FFB74D',
    },
    info: {
      main: '#29B6F6',
    },
    success: {
      main: '#66BB6A',
    },
    background: {
      paper: '#1F2736',
      default: '#141D2B',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5',
    },
  },
});

const DatabaseTester = () => {
  const navigate = useNavigate();
  
  // State for database connection
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // State for query tab
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  
  // State for schema metadata
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [relationshipData, setRelationshipData] = useState(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false); // Track if metadata has been loaded
  
  // State for description editing
  const [editingDescription, setEditingDescription] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  
  // State for search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  
  // State for changes modal
  const [changesModal, setChangesModal] = useState({
    open: false,
    changes: null
  });
  
  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });
  
  // State for the ER diagram
  const [erDiagramLoading, setErDiagramLoading] = useState(false);
  const [erDiagramError, setErDiagramError] = useState(null);
  
  // State for snackbar notification
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info"
  });
  
  // Function to show snackbar notification
  const showSnackbar = (message, severity = "info") => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };
  
  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };
  
  // Load databases on component mount
  useEffect(() => {
    fetchDatabases();
  }, []);
  
  // Function to fetch databases from the API
  const fetchDatabases = async () => {
    try {
      setLoading(true);
      const response = await api.getDatabases();
      setDatabases(response.data);
    } catch (err) {
      showSnackbar("Failed to fetch databases", "error");
      console.error("Error fetching databases:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch all metadata at once
  const fetchAllMetadata = async (dbId) => {
    if (!dbId) return;
    
    try {
      setMetadataLoading(true);
      
      // Fetch schema data
      const schemaResponse = await api.get(`/api/databases/databases/${dbId}/schema/`);
      setSchemaData(schemaResponse.data);
      
      // Fetch relationship data
      const relationshipResponse = await api.get(`/api/databases/databases/${dbId}/relationships/`);
      setRelationshipData(relationshipResponse.data);
      
      // Generate ER diagram
      try {
        await api.getERDiagram(dbId);
      } catch (err) {
        console.error("Error generating ER diagram:", err);
        // Non-blocking error, we'll continue even if ER diagram fails
      }
      
      setMetadataLoaded(true);
      showSnackbar("Metadata loaded successfully", "success");
    } catch (err) {
      showSnackbar("Failed to fetch metadata", "error");
      console.error("Error fetching metadata:", err);
    } finally {
      setMetadataLoading(false);
    }
  };
  
  // Test database connection
  const handleTestConnection = async (dbId) => {
    try {
      setLoading(true);
      const response = await api.testConnection(dbId);
      
      if (response.data.success) {
        showSnackbar("Connection successful!", "success");
      } else {
        showSnackbar("Connection failed: " + response.data.message, "error");
      }
    } catch (err) {
      showSnackbar("Connection failed", "error");
      console.error("Error testing connection:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // Extract metadata from the selected database
  const handleExtractMetadata = async () => {
    if (!selectedDb) {
      showSnackbar("Please select a database first", "error");
      return;
    }
    
    try {
      setMetadataLoading(true);
      const response = await api.post(`/api/databases/databases/${selectedDb}/extract_metadata/`);
      if (response.data.success) {
        showSnackbar(response.data.message, "success");
        
        // Show changes modal if there are any changes
        const changes = response.data.changes;
        if (changes && (
            changes.tables.added.length > 0 || 
            changes.tables.updated.length > 0 || 
            changes.tables.removed.length > 0 ||
            changes.columns.added.length > 0 || 
            changes.columns.updated.length > 0 || 
            changes.columns.removed.length > 0 ||
            changes.relationships.added.length > 0 || 
            changes.relationships.updated.length > 0 || 
            changes.relationships.removed.length > 0
        )) {
          setChangesModal({
            open: true,
            changes: changes
          });
        }
        
        // Fetch all metadata after extraction
        await fetchAllMetadata(selectedDb);
      } else {
        showSnackbar("Metadata extraction failed", "error");
      }
    } catch (err) {
      showSnackbar("Failed to extract metadata", "error");
      console.error("Error extracting metadata:", err);
    } finally {
      setMetadataLoading(false);
    }
  };
  
  // Update embeddings for the selected database
  const handleUpdateEmbeddings = async () => {
    if (!selectedDb) {
      showSnackbar("Please select a database first", "error");
      return;
    }
    
    try {
      setMetadataLoading(true);
      const response = await api.post(`/api/databases/databases/${selectedDb}/update_embeddings/`);
      showSnackbar(response.data.message, response.data.success ? "success" : "error");
    } catch (err) {
      showSnackbar("Failed to update embeddings", "error");
      console.error("Error updating embeddings:", err);
    } finally {
      setMetadataLoading(false);
    }
  };
  
  // Fetch schema data for the selected database
  const fetchSchema = () => {
    if (!metadataLoaded) {
      // Only fetch if not already loaded
      fetchAllMetadata(selectedDb);
    }
    setActiveTab(1); // Switch to schema tab
  };
  
  // Fetch relationship data for the selected database
  const fetchRelationships = () => {
    if (!metadataLoaded) {
      // Only fetch if not already loaded  
      fetchAllMetadata(selectedDb);
    }
    setActiveTab(2); // Switch to relationships tab
  };
  
  // Search metadata in the selected database
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!selectedDb) {
      showSnackbar("Please select a database first", "warning");
      return;
    }
    
    if (!searchQuery.trim()) {
      showSnackbar("Please enter a search query", "warning");
      return;
    }
    
    try {
      setMetadataLoading(true);
      const response = await api.get(`/api/databases/databases/${selectedDb}/search/?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (err) {
      showSnackbar("Failed to search metadata", "error");
      console.error("Error searching metadata:", err);
    } finally {
      setMetadataLoading(false);
    }
  };

  // Handle database deletion
  const handleDeleteDatabase = async (dbId) => {
    setConfirmDialog({
      open: true,
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this database connection? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await api.deleteDatabase(dbId);
          showSnackbar("Database deleted successfully", "success");
          
          // Update the databases list
          fetchDatabases();
          
          // Reset selected database if it was deleted
          if (selectedDb === dbId) {
            setSelectedDb(null);
            setSchemaData(null);
            setRelationshipData(null);
            setQueryResult(null);
            setSearchResults(null);
          }
        } catch (err) {
          showSnackbar("Failed to delete database", "error");
          console.error("Error deleting database:", err);
        } finally {
          setConfirmDialog({
            ...confirmDialog,
            open: false
          });
        }
      }
    });
  };

  // Handle database added
  const handleDatabaseAdded = (result) => {
    if (result.message) {
      showSnackbar(result.message, result.severity || "info");
    }
    
    if (result.success) {
      fetchDatabases();
    }
  };
  
  // Handle database selection
  const handleDatabaseSelect = (dbId) => {
    setSelectedDb(dbId);
    setQueryResult(null);
    setQueryError(null);
    setSchemaData(null);
    setRelationshipData(null);
    setSearchResults(null);
    setMetadataLoaded(false); // Reset metadata loaded flag
    setActiveTab(0);
    showSnackbar("Database selected");
    setErDiagramLoading(false);
    setErDiagramError(null);
    // fetchAllMetadata will be called by the useEffect above
  };

  // Handle description saving
  const handleSaveDescription = async (type, id, newDescription) => {
    try {
      setDescriptionLoading(true);
      const response = await api.post(`/api/databases/databases/${selectedDb}/update_description/`, {
        type,
        id,
        description: newDescription
      });
      if (response.data.success) {
        // Update the local state with the new description
        if (type === 'table') {
          setSchemaData((prevSchemaData) =>
            prevSchemaData.map((table) =>
              table.id === id
                ? { ...table, description: newDescription }
                : table
            )
          );
        } else if (type === 'column') {
          setSchemaData((prevSchemaData) =>
            prevSchemaData.map((table) => ({
              ...table,
              columns: table.columns.map((column) =>
                column.id === id
                  ? { ...column, description: newDescription }
                  : column
              ),
            }))
          );
        }
        showSnackbar("Description updated successfully", "success");
      } else {
        showSnackbar("Failed to update description", "error");
      }
    } catch (err) {
      showSnackbar("Error updating description", "error");
      console.error("Error updating description:", err);
    } finally {
      setDescriptionLoading(false);
    }
  };

  // Handle AI description generation
  const handleGenerateAIDescription = async (type, id) => {
    try {
      setDescriptionLoading(true);
      
      // Call the DatabaseViewSet endpoint with the correct parameters
      const response = await api.generateMetadataDescription(selectedDb, type, id);
      
      if (response.data.description) {
        setEditDescription(response.data.description);
        showSnackbar("AI description generated", "success");
      } else {
        showSnackbar("Failed to generate description", "error");
      }
    } catch (err) {
      showSnackbar("Error generating description", "error");
      console.error("Error generating description:", err);
    } finally {
      setDescriptionLoading(false);
    }
  };

  // Handle ER diagram generation
  const handleGenerateERDiagram = async () => {
    if (!selectedDb) return;
    
    setErDiagramLoading(true);
    setErDiagramError(null);
    
    try {
      // This will indirectly generate the ER diagram on the backend
      await api.getERDiagram(selectedDb);
      showSnackbar("ER Diagram generated successfully", "success");
    } catch (error) {
      setErDiagramError(`Failed to generate ER diagram: ${error.message}`);
      showSnackbar(`Error generating ER diagram: ${error.message}`, "error");
    } finally {
      setErDiagramLoading(false);
    }
  };

  // Handle query execution result from QueryPanel component
  const handleQueryResult = (result) => {
    setQueryResult(result);
  };

  // Load metadata when database is selected
  useEffect(() => {
    if (selectedDb) {
      fetchAllMetadata(selectedDb);
    }
  }, [selectedDb]);

  return (
    <ThemeProvider theme={darkTheme}>
      <Navbar />
      <Container 
        maxWidth="xl" 
        sx={{ 
          pt: '84px',
          pb: 8,
          background: 'linear-gradient(180deg, rgba(26, 35, 50, 0.97) 0%, rgba(18, 26, 41, 0.98) 100%)',
          color: '#fff', 
          minHeight: '100vh'
        }}
      >
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton 
            onClick={() => navigate('/databases')} 
            color="primary" 
            aria-label="back to databases"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 1, fontWeight: 700 }}>
            Database Tester
          </Typography>
        </Box>

        {/* Top Row - Connection Form and Database List side by side */}
        <Box sx={{ 
          display: "flex", 
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          mb: 4
        }}>
          {/* Database Connection Form */}
          <Box sx={{ flex: { xs: "1", md: "1" }, width: "100%" }}>
            <DatabaseConnectionForm 
              onDatabaseAdded={handleDatabaseAdded}
              darkTheme={darkTheme}
            />
          </Box>

          {/* Database List - Now on the right side */}
          <Box sx={{ flex: { xs: "1", md: "1" }, width: "100%" }}>
            <DatabaseList 
              databases={databases}
              loading={loading}
              selectedDb={selectedDb}
              onDatabaseSelect={handleDatabaseSelect}
              onDeleteClick={handleDeleteDatabase}
              onTestConnection={handleTestConnection}
              metadataLoading={metadataLoading}
              onExtractMetadata={handleExtractMetadata}
              onUpdateEmbeddings={handleUpdateEmbeddings}
              onViewSchema={fetchSchema}
              onViewRelationships={fetchRelationships}
            />
          </Box>
        </Box>
        
        {/* Bottom section - Schema content */}
        {selectedDb ? (
          <Paper className="p-6 rounded-lg shadow-md" sx={{ 
            backgroundColor: '#1F2736',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Connection" />
              <Tab label="Schema" />
              <Tab label="Relationships" />
              <Tab label="Query" />
              <Tab label="Search" />
              <Tab label="ER Diagram" />
            </Tabs>

            <Box sx={{ p: 2 }}>
              {/* Connection Tab Content */}
              {activeTab === 0 && (
                <Box>
                  <Typography variant="h6" className="mb-4">
                    Database Connection
                  </Typography>
                  
                  {selectedDb && databases.find(db => db.id === selectedDb) && (
                    <Box>
                      <Typography variant="subtitle1" className="font-semibold">
                        {databases.find(db => db.id === selectedDb).name}
                      </Typography>
                      <Typography variant="body2" className="text-gray-400">
                        {databases.find(db => db.id === selectedDb).description}
                      </Typography>
                      <Box className="mt-4 grid grid-cols-2 gap-4">
                        <Box>
                          <Typography variant="caption" className="text-gray-400 block">
                            Type
                          </Typography>
                          <Typography className="font-medium">
                            {databases.find(db => db.id === selectedDb).database_type}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" className="text-gray-400 block">
                            Host
                          </Typography>
                          <Typography className="font-medium">
                            {databases.find(db => db.id === selectedDb).host}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" className="text-gray-400 block">
                            Port
                          </Typography>
                          <Typography className="font-medium">
                            {databases.find(db => db.id === selectedDb).port}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" className="text-gray-400 block">
                            Database Name
                          </Typography>
                          <Typography className="font-medium">
                            {databases.find(db => db.id === selectedDb).database_name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" className="text-gray-400 block">
                            Username
                          </Typography>
                          <Typography className="font-medium">
                            {databases.find(db => db.id === selectedDb).username}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Schema Tab Content */}
              {activeTab === 1 && (
                <SchemaPanel 
                  schemaData={schemaData}
                  metadataLoading={metadataLoading}
                  onExtractMetadata={handleExtractMetadata}
                  onSaveDescription={handleSaveDescription}
                  onGenerateAIDescription={handleGenerateAIDescription}
                  editDescription={editDescription}
                  setEditDescription={setEditDescription}
                  editingDescription={editingDescription}
                  setEditingDescription={setEditingDescription}
                  descriptionLoading={descriptionLoading}
                />
              )}
              
              {/* Relationships Tab Content */}
              {activeTab === 2 && (
                <RelationshipsPanel 
                  relationshipData={relationshipData}
                  metadataLoading={metadataLoading}
                  onExtractMetadata={handleExtractMetadata}
                />
              )}
              
              {/* Query Tab Content */}
              {activeTab === 3 && (
                <QueryPanel 
                  selectedDb={selectedDb}
                  onQueryResult={handleQueryResult}
                />
              )}
              
              {/* Search Tab Content */}
              {activeTab === 4 && (
                <SearchPanel 
                  selectedDb={selectedDb}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchResults={searchResults}
                  metadataLoading={metadataLoading}
                  onSearch={handleSearch}
                />
              )}
              
              {/* ER Diagram Tab Content */}
              {activeTab === 5 && (
                <ERDiagramPanel 
                  selectedDb={selectedDb}
                  erDiagramLoading={erDiagramLoading}
                  erDiagramError={erDiagramError}
                  onGenerateERDiagram={handleGenerateERDiagram}
                  showSnackbar={showSnackbar}
                />
              )}
            </Box>
          </Paper>
        ) : (
          <Box className="text-center p-8 bg-opacity-50 rounded-lg" sx={{ 
            backgroundColor: 'rgba(31, 39, 54, 0.5)',
            border: '1px dashed rgba(255, 255, 255, 0.2)'
          }}>
            <Typography variant="h6" className="mb-2">
              No Database Selected
            </Typography>
            <Typography className="text-gray-400">
              Add a new database connection or select an existing one to start.
            </Typography>
          </Box>
        )}
        
        {/* Query Results Section - Full Width */}
        {selectedDb && activeTab === 3 && queryResult && (
          <Box className="mt-8 w-full">
            <QueryResultPanel queryResult={queryResult} />
          </Box>
        )}
        
        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity} 
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
        
        {/* Changes Modal */}
        <Dialog 
          open={changesModal.open} 
          onClose={() => setChangesModal({ ...changesModal, open: false })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Metadata Changes
            <IconButton
              aria-label="close"
              onClick={() => setChangesModal({ ...changesModal, open: false })}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {changesModal.changes && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Tables
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="success.main">
                    Added: {changesModal.changes.tables.added.length}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Updated: {changesModal.changes.tables.updated.length}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    Removed: {changesModal.changes.tables.removed.length}
                  </Typography>
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  Columns
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="success.main">
                    Added: {changesModal.changes.columns.added.length}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Updated: {changesModal.changes.columns.updated.length}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    Removed: {changesModal.changes.columns.removed.length}
                  </Typography>
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  Relationships
                </Typography>
                <Box>
                  <Typography variant="body2" color="success.main">
                    Added: {changesModal.changes.relationships.added.length}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Updated: {changesModal.changes.relationships.updated.length}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    Removed: {changesModal.changes.relationships.removed.length}
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setChangesModal({ ...changesModal, open: false })}
              color="primary"
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        >
          <DialogTitle>{confirmDialog.title}</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} 
              color="primary"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDialog.onConfirm} 
              color="error" 
              variant="contained"
              autoFocus
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
};

export default DatabaseTester;