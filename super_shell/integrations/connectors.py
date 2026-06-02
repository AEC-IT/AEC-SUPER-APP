import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class DownstreamConnector:
    @staticmethod
    def _get_headers(auth_token=None):
        headers = {
            'Content-Type': 'application/json',
        }
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        return headers

    @classmethod
    def _fetch(cls, url, auth_token=None, params=None, timeout=3.0):
        try:
            headers = cls._get_headers(auth_token)
            response = requests.get(url, headers=headers, params=params, timeout=timeout)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Downstream API returned {response.status_code} for URL: {url}. Content: {response.text}")
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Downstream connection error for URL: {url}. Details: {e}")
            return None

    @classmethod
    def _patch(cls, url, auth_token=None, json_data=None, timeout=3.0):
        try:
            headers = cls._get_headers(auth_token)
            response = requests.patch(url, headers=headers, json=json_data, timeout=timeout)
            if response.status_code in [200, 201, 204]:
                return response.json()
            else:
                logger.error(f"Downstream API returned {response.status_code} for URL: {url}. Content: {response.text}")
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Downstream connection error for URL: {url}. Details: {e}")
            return None

    @classmethod
    def _post(cls, url, auth_token=None, json_data=None, timeout=3.0):
        try:
            headers = cls._get_headers(auth_token)
            response = requests.post(url, headers=headers, json=json_data, timeout=timeout)
            if response.status_code in [200, 201, 204]:
                try:
                    return response.json()
                except ValueError:
                    return {"status": "success"}
            else:
                logger.error(f"Downstream API returned {response.status_code} for URL: {url}. Content: {response.text}")
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Downstream connection error for URL: {url}. Details: {e}")
            return None


class HRAppConnector(DownstreamConnector):
    @classmethod
    def get_summary(cls, auth_token):
        url = f"{settings.HR_APP_API_URL.rstrip('/')}/api/v1/hr/dashboard/summary/"
        return cls._fetch(url, auth_token=auth_token)

    @classmethod
    def get_pending_leaves(cls, auth_token):
        url = f"{settings.HR_APP_API_URL.rstrip('/')}/api/v1/hr/leaves/"
        return cls._fetch(url, auth_token=auth_token, params={'status': 'PENDING'})

    @classmethod
    def action_leave(cls, auth_token, leave_id, action, note=None):
        url = f"{settings.HR_APP_API_URL.rstrip('/')}/api/v1/hr/leaves/{leave_id}/"
        payload = {'status': action}
        if note and action == 'REJECTED':
            payload['rejection_reason'] = note
        return cls._patch(url, auth_token=auth_token, json_data=payload)


class TheaterERPConnector(DownstreamConnector):
    @classmethod
    def get_summary(cls, auth_token):
        url = f"{settings.THEATER_ERP_API_URL.rstrip('/')}/api/operations/dashboard/summary/"
        return cls._fetch(url, auth_token=auth_token)

    @classmethod
    def get_open_alerts(cls, auth_token):
        url = f"{settings.THEATER_ERP_API_URL.rstrip('/')}/api/operations/alerts/"
        return cls._fetch(url, auth_token=auth_token, params={'status': 'TRIGGERED'})

    @classmethod
    def action_alert(cls, auth_token, alert_id, action, note=None):
        # Acknowledge, resolve, or snooze
        action_path = action.lower()  # acknowledge, resolve, snooze
        url = f"{settings.THEATER_ERP_API_URL.rstrip('/')}/api/operations/alerts/{alert_id}/{action_path}/"
        payload = {}
        if action_path == 'resolve':
            payload['resolution_note'] = note or "Resolved by Managing Director"
        return cls._post(url, auth_token=auth_token, json_data=payload)

