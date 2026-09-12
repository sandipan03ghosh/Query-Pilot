from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DatabaseViewSet

router = DefaultRouter()
router.register(r'databases', DatabaseViewSet)

urlpatterns = [
    path('', include(router.urls)),
]