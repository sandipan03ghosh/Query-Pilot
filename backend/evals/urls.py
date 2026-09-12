from django.urls import path

from . import views

urlpatterns = [
    path("runs/", views.EvalRunListView.as_view(), name="eval-run-list"),
    path("runs/<int:pk>/", views.EvalRunDetailView.as_view(), name="eval-run-detail"),
]
