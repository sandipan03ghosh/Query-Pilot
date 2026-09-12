from django.urls import path
from . import views
from .firebase_auth import FirebaseAuthView  # Import the Firebase auth view

urlpatterns = [
    path('register/', views.CreateUserView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),  # Add the new login endpoint
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('firebase-auth/', FirebaseAuthView.as_view(), name='firebase-auth'),
    path('me/', views.UserInfoView.as_view(), name='user-info'),
    # Password change endpoints
    path('request-password-change/', views.RequestPasswordChangeView.as_view(), name='request-password-change'),
    path('verify-otp/', views.VerifyOTPView.as_view(), name='verify-otp'),
    path('set-new-password/', views.SetNewPasswordView.as_view(), name='set-new-password'),
    # Token usage endpoint
    path('token-usage/', views.TokenUsageView.as_view(), name='token-usage'),
]
