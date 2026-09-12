from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# API URL patterns
api_patterns = [
    path("user/", include("user.urls")),
    path("sessions/", include("session.urls")),
    path("databases/", include("databases.urls")),
    path("llm/", include("llm_agent.urls")),
    path("evals/", include("evals.urls")),
    path("token/", TokenObtainPairView.as_view(), name="get_token"),
    path("token/refresh/", TokenRefreshView.as_view(), name="refresh"),
    # If there are any api app specific URLs, include them at the root level
    path("", include("api.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # All API endpoints are under /api/
    path("api/", include(api_patterns)),
    path("api-auth/", include("rest_framework.urls")),
]
