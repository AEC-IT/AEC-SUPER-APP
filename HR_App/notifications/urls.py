from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='list'),
    path('post/', views.PostNotificationView.as_view(), name='post'),
    path('mark-read/<int:pk>/', views.MarkReadView.as_view(), name='mark_read'),
    path('mark-all-read/', views.MarkAllReadView.as_view(), name='mark_all_read'),
    path('delete/<int:pk>/', views.DeleteNotificationView.as_view(), name='delete'),
    path('send-wish/<int:notif_id>/', views.SendStaffWishView.as_view(), name='send_wish'),
    path('push/key/', views.push_public_key, name='push_key'),
    path('push/subscribe/', views.push_subscribe, name='push_subscribe'),
    path('push/test/', views.push_test, name='push_test'),
]
