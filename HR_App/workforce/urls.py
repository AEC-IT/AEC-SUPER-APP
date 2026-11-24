from django.urls import path
from . import views

app_name = 'workforce'

urlpatterns = [
    path('locations/', views.locations, name='locations'),
    path('roster/', views.roster, name='roster'),
    path('roster/assign/', views.assign, name='assign'),
    path('shifts/new/', views.shift_create, name='shift_create'),
    path('swaps/new/', views.swap_create, name='swap_create'),
    path('swaps/<int:pk>/', views.swap_respond, name='swap_respond'),
    path('performance/', views.performance, name='performance'),
    path('performance/goal/', views.goal_save, name='goal_save'),
    path('performance/review/<int:pk>/', views.review_detail, name='review'),
]
