from django.urls import path
from . import views

app_name = 'staffapp'

urlpatterns = [
    path('', views.home, name='home'),
    path('break/', views.toggle_break, name='break'),
    path('attendance/', views.attendance, name='attendance'),
    path('feed/', views.feed, name='feed'),
    path('services/', views.services, name='services'),
    path('profile/', views.profile, name='profile'),
    path('leaves/', views.leaves, name='leaves'),
    path('leave/new/', views.leave_new, name='leave_new'),
    path('schedule/', views.schedule, name='schedule'),
    path('tasks/', views.tasks, name='tasks'),
]
