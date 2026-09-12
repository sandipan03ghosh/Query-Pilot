from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from .serializers import UserSerializer
import firebase_admin
from firebase_admin import auth

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Endpoint to handle password changes.
    Requires current_password, new_password in the request body.
    """
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response(
            {"detail": "Both current password and new password are required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get the user's Firebase UID from JWT claims
    firebase_uid = request.auth.get('uid', None)
    
    if not firebase_uid:
        return Response(
            {"detail": "Could not identify Firebase user"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Update the Firebase user's password
        auth.update_user(firebase_uid, password=new_password)
        
        return Response({"success": True, "message": "Password changed successfully"})
    except auth.AuthError as e:
        error_message = str(e)
        if "INVALID_ID_TOKEN" in error_message:
            return Response(
                {"detail": "Authentication session expired. Please log in again."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        elif "WEAK_PASSWORD" in error_message:
            return Response(
                {"detail": "Password is too weak. Please use a stronger password."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {"detail": f"Firebase error: {error_message}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        return Response(
            {"detail": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )