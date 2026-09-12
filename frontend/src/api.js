import { ACCESS_TOKEN } from "./constants";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function buildUrl(url, params) {
  const full = `${BASE_URL}${url}`;
  if (!params) return full;

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.append(key, value);
    }
  });

  const qs = search.toString();
  if (!qs) return full;
  return `${full}${full.includes("?") ? "&" : "?"}${qs}`;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(method, url, data, config = {}) {
  const { params, headers: extraHeaders, ...rest } = config;
  const headers = { ...extraHeaders };

  const token = localStorage.getItem(ACCESS_TOKEN);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init = { method, headers, ...rest };
  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(data);
  }

  const response = await fetch(buildUrl(url, params), init);
  const responseData = await parseBody(response);
  const result = {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };

  if (!response.ok) {
    const error = new Error(
      responseData?.detail ||
        responseData?.error ||
        `Request failed with status code ${response.status}`
    );
    error.response = result;
    throw error;
  }

  return result;
}

const api = {
  get: (url, config) => request("GET", url, undefined, config),
  delete: (url, config) => request("DELETE", url, undefined, config),
  post: (url, data, config) => request("POST", url, data, config),
  patch: (url, data, config) => request("PATCH", url, data, config),
};

// Session management functions - all endpoints are now under /api/ prefix
api.getSessions = () => api.get("/api/sessions/");
api.createSession = (title, database) =>
  api.post("/api/sessions/", { title, database });
api.getSession = (sessionId) => api.get(`/api/sessions/${sessionId}/`);
api.updateSessionTitle = (sessionId, title) =>
  api.patch(`/api/sessions/${sessionId}/`, { title });
api.deleteSession = (sessionId) => api.delete(`/api/sessions/${sessionId}/`);
api.addQueryToSession = (
  sessionId,
  prompt,
  response,
  success = true,
  errorType = null,
  error = null,
  generatedSql = null,
  explanation = null
) =>
  api.post(`/api/sessions/${sessionId}/queries/`, {
    prompt,
    response,
    success,
    error_type: errorType,
    error,
    generated_sql: generatedSql,
    explanation,
  });
api.updateQuery = (sessionId, queryId, updateData) =>
  api.patch(`/api/sessions/${sessionId}/queries/${queryId}/`, updateData);
api.deleteQueryFromSession = (sessionId, queryId) =>
  api.delete(`/api/sessions/${sessionId}/queries/${queryId}/`);

// Database management functions
api.getDatabases = () => api.get("/api/databases/databases/");
api.getDatabase = (databaseId) =>
  api.get(`/api/databases/databases/${databaseId}/`);
api.createDatabase = (databaseData) =>
  api.post("/api/databases/databases/", databaseData);
api.updateDatabase = (databaseId, databaseData) =>
  api.patch(`/api/databases/databases/${databaseId}/`, databaseData);
api.deleteDatabase = (databaseId) =>
  api.delete(`/api/databases/databases/${databaseId}/`);
api.testConnection = (databaseId) =>
  api.post(`/api/databases/databases/${databaseId}/test_connection/`);
api.refreshMetadata = (databaseId) =>
  api.post(`/api/databases/databases/${databaseId}/refresh_metadata/`);

// Metadata management functions
api.getTableMetadata = (databaseId) =>
  api.get(`/api/databases/databases/${databaseId}/tables/`);
api.updateTableMetadata = (tableId, metadata) =>
  api.patch(`/api/databases/tables/${tableId}/`, metadata);
api.getColumnMetadata = (tableId) =>
  api.get(`/api/databases/tables/${tableId}/columns/`);
api.updateColumnMetadata = (columnId, metadata) =>
  api.patch(`/api/databases/columns/${columnId}/`, metadata);

// Database metadata functions
api.getSessionsByDatabase = (databaseId) =>
  api.get(`/api/sessions/?database_id=${databaseId}`);
api.generateMetadataDescription = (databaseId, type, id) =>
  api.post(`/api/databases/databases/${databaseId}/generate_description/`, {
    type,
    id,
  });

// NL to SQL conversion
api.generateSqlFromNL = (query, databaseId) =>
  api.post("/api/llm/generate-sql/", {
    query,
    database_id: databaseId,
  });

// Combined pipeline: generate -> guardrails -> execute -> verify -> confidence.
api.runQuery = (query, databaseId, { sessionId = null, deep = false } = {}) =>
  api.post("/api/llm/query/", {
    query,
    database_id: databaseId,
    session_id: sessionId ?? undefined,
    deep,
  });

// 👍 / 👎 on a generated query (feeds the feedback flywheel).
api.submitQueryFeedback = (sessionId, queryId, feedback) =>
  api.patch(`/api/sessions/${sessionId}/queries/${queryId}/`, { feedback });

// Evaluation dashboard: recent run summaries.
api.getEvalRuns = ({ subset = null, limit = 50 } = {}) =>
  api.get("/api/evals/runs/", { params: { subset: subset ?? undefined, limit } });

// Execute SQL query
api.executeSqlQuery = (databaseId, sqlQuery) =>
  api.post(`/api/databases/databases/${databaseId}/execute_query/`, {
    query: sqlQuery,
  });

// ER Diagram
api.getERDiagram = (databaseId) =>
  api.get(`/api/databases/databases/${databaseId}/er_diagram/`);

// Token Usage
api.getTokenUsage = (days, limit) => {
  let url = "/api/user/token-usage/";
  const params = {};
  if (days) params.days = days;
  if (limit) params.limit = limit;
  return api.get(url, { params });
};

// Semantic Learning Platform: model versions, experiments, drift, semantic graph
api.getModelVersions = () => api.get("/api/llm/model-versions/");
api.getModelVersion = (id) => api.get(`/api/llm/model-versions/${id}/`);
api.activateModelVersion = (id) => api.post(`/api/llm/model-versions/${id}/activate/`);
api.getExperiments = () => api.get("/api/llm/experiments/");
api.getExperiment = (id) => api.get(`/api/llm/experiments/${id}/`);
api.getDriftMetrics = (databaseId) => {
  const params = {};
  if (databaseId) params.database_id = databaseId;
  return api.get("/api/llm/drift-metrics/", { params });
};
api.getEmbeddingProjection = (databaseId) =>
  api.get("/api/llm/embedding-projection/", { params: { database_id: databaseId } });
api.getSemanticGraph = (databaseId) =>
  api.get(`/api/databases/databases/${databaseId}/semantic_graph/`);

export default api;
