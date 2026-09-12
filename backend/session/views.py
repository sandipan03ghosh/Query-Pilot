from django.shortcuts import render
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Session, Query
from .serializers import SessionSerializer, SessionListSerializer, QuerySerializer


class SessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Filter by database_id if provided in query parameters
        database_id = request.query_params.get('database_id')
        
        if database_id:
            sessions = Session.objects.filter(user=request.user, database_id=database_id)
        else:
            sessions = Session.objects.filter(user=request.user)
            
        serializer = SessionListSerializer(sessions, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        # Create a new session for the user
        session_data = {
            'user': request.user,
            'title': request.data.get('title', 'New Session'),
        }
        
        # Add database information if provided
        if 'database' in request.data and request.data['database']:
            database = request.data['database']
            if isinstance(database, dict):
                session_data['database_name'] = database.get('name')
                session_data['database_id'] = database.get('id')
        
        session = Session.objects.create(**session_data)
        serializer = SessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SessionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            session = Session.objects.get(pk=pk, user=request.user)
            serializer = SessionSerializer(session)
            return Response(serializer.data)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found", "error_type": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request, pk):
        try:
            session = Session.objects.get(pk=pk, user=request.user)
            if 'title' in request.data:
                session.title = request.data['title']
                session.save()
            serializer = SessionSerializer(session)
            return Response(serializer.data)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found", "error_type": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    
    def delete(self, request, pk):
        try:
            session = Session.objects.get(pk=pk, user=request.user)
            session.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found", "error_type": "not_found"}, status=status.HTTP_404_NOT_FOUND)


class QueryCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, session_id):
        try:
            session = Session.objects.get(pk=session_id, user=request.user)
            
            # Update session timestamp when new query is added
            session.save()  # This triggers the auto_now field update
            
            query_data = {
                'prompt': request.data.get('prompt', ''),
                'response': request.data.get('response', ''),
                'success': request.data.get('success', True),
                'error_type': request.data.get('error_type'),
                'error': request.data.get('error'),
                'generated_sql': request.data.get('generated_sql'),
                'explanation': request.data.get('explanation')
            }
            
            query = Query.objects.create(
                session=session,
                **query_data
            )
            
            serializer = QuerySerializer(query)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)


class QueryDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id, query_id):
        try:
            # First check if the session belongs to the user
            session = Session.objects.get(pk=session_id, user=request.user)
            
            try:
                # Find the query within this session
                query = Query.objects.get(pk=query_id, session=session)
                serializer = QuerySerializer(query)
                return Response(serializer.data)
            except Query.DoesNotExist:
                return Response({"detail": "Query not found"}, status=status.HTTP_404_NOT_FOUND)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request, session_id, query_id):
        try:
            # First check if the session belongs to the user
            session = Session.objects.get(pk=session_id, user=request.user)
            
            try:
                # Find the query within this session
                query = Query.objects.get(pk=query_id, session=session)
                
                # Update the fields that are provided in the request
                if 'response' in request.data:
                    query.response = request.data['response']
                if 'success' in request.data:
                    query.success = request.data['success']
                if 'error_type' in request.data:
                    query.error_type = request.data['error_type']
                if 'error' in request.data:
                    query.error = request.data['error']
                if 'generated_sql' in request.data:
                    query.generated_sql = request.data['generated_sql']
                if 'explanation' in request.data:
                    query.explanation = request.data['explanation']
                if 'feedback' in request.data:
                    # 👍/👎 on the generated SQL — feeds promote_feedback and the
                    # drift signal. Only the two choices or null are accepted.
                    fb = request.data['feedback']
                    valid = {c[0] for c in Query.FEEDBACK_CHOICES}
                    query.feedback = fb if fb in valid else None

                query.save()
                serializer = QuerySerializer(query)
                return Response(serializer.data)
            except Query.DoesNotExist:
                return Response({"detail": "Query not found"}, status=status.HTTP_404_NOT_FOUND)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
    
    def delete(self, request, session_id, query_id):
        try:
            # First check if the session belongs to the user
            session = Session.objects.get(pk=session_id, user=request.user)
            
            try:
                # Find the query within this session
                query = Query.objects.get(pk=query_id, session=session)
                query.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except Query.DoesNotExist:
                return Response({"detail": "Query not found"}, status=status.HTTP_404_NOT_FOUND)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
