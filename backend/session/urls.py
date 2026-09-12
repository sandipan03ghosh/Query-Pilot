from django.urls import path
from . import views

urlpatterns = [
    # Session management endpoints
    path('', views.SessionListCreateView.as_view(), name='session-list-create'),
    path('<int:pk>/', views.SessionDetailView.as_view(), name='session-detail'),
    path('<int:session_id>/queries/', views.QueryCreateView.as_view(), name='query-create'),
    path('<int:session_id>/queries/<int:query_id>/', views.QueryDetailView.as_view(), name='query-detail'),
]
