from django.urls import path
from . import views

urlpatterns = [
    path('generate-sql/', views.generate_sql_from_nl, name='generate-sql'),
    path('query/', views.run_query, name='run-query'),
    # Removed redundant generate-description endpoint

    path('model-versions/', views.ModelVersionListView.as_view(), name='model-version-list'),
    path('model-versions/<int:pk>/', views.ModelVersionDetailView.as_view(), name='model-version-detail'),
    path('model-versions/<int:pk>/activate/', views.ActivateModelVersionView.as_view(), name='model-version-activate'),

    path('experiments/', views.ExperimentRunListView.as_view(), name='experiment-list'),
    path('experiments/<int:pk>/', views.ExperimentRunDetailView.as_view(), name='experiment-detail'),

    path('drift-metrics/', views.DriftMetricsListView.as_view(), name='drift-metrics-list'),
    path('embedding-projection/', views.EmbeddingProjectionView.as_view(), name='embedding-projection'),
]