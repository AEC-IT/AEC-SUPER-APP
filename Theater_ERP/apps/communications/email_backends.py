"""
apps/communications/email_backends.py
AEC Cinemas – Brevo (Sendinblue) Transactional Email Backend

Ported from HR_App/core/email_backends.py and made tenant-aware.

Usage (settings.py):
    EMAIL_BACKEND = 'apps.communications.email_backends.BrevoEmailBackend'
    BREVO_API_KEY = 'your-api-key'
    BREVO_SENDER_EMAIL = 'noreply@aeccinemas.com'
    BREVO_SENDER_NAME = 'AEC Cinemas'

The backend is a drop-in replacement for Django's built-in email backends.
It is called transparently whenever Django's send_mail() or EmailMessage.send()
is used — no call-site changes needed.
"""

import json
import logging
import urllib.request
import urllib.error

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class BrevoEmailBackend(BaseEmailBackend):
    """
    Django email backend that delivers via the Brevo (Sendinblue) Transactional
    Email API v3.  Implements the minimal interface required by Django's mailer
    (open / close / send_messages).

    Thread-safety: Each send_messages call is independent; no shared state is
    mutated after __init__, so the backend is safe to use in multi-threaded
    Gunicorn / uWSGI deployments.
    """

    BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = getattr(settings, 'BREVO_API_KEY', '')
        self.sender_email = getattr(settings, 'BREVO_SENDER_EMAIL', 'noreply@aeccinemas.com')
        self.sender_name = getattr(settings, 'BREVO_SENDER_NAME', 'AEC Cinemas')

    # ── Django backend lifecycle ──────────────────────────────────────────────

    def open(self):
        """No persistent connection needed for REST API."""
        return True

    def close(self):
        """Nothing to close."""
        pass

    # ── Core send logic ───────────────────────────────────────────────────────

    def send_messages(self, email_messages):
        """
        Send a list of EmailMessage objects through the Brevo API.
        Returns the number of messages sent successfully.
        """
        if not self.api_key:
            logger.warning('[BREVO] BREVO_API_KEY is not configured. Email not sent.')
            return 0

        sent_count = 0
        for message in email_messages:
            try:
                self._send_single(message)
                sent_count += 1
            except Exception as exc:
                logger.error('[BREVO] Failed to send email to %s: %s', message.to, exc)
                if not self.fail_silently:
                    raise
        return sent_count

    def _send_single(self, message):
        """
        Translate a Django EmailMessage into a Brevo API request and dispatch it.
        Supports plain-text and HTML (via the `alternatives` attribute on
        EmailMultiAlternatives).
        """
        # Resolve HTML body if present (EmailMultiAlternatives sets .alternatives)
        html_content = None
        text_content = message.body

        if hasattr(message, 'alternatives'):
            for content, mimetype in message.alternatives:
                if mimetype == 'text/html':
                    html_content = content
                    break

        # Build the Brevo payload
        payload = {
            'sender': {
                'name': self.sender_name,
                'email': self.sender_email,
            },
            'to': [{'email': addr} for addr in message.to],
            'subject': message.subject,
            'textContent': text_content,
        }

        if html_content:
            payload['htmlContent'] = html_content

        # CC and BCC
        if message.cc:
            payload['cc'] = [{'email': addr} for addr in message.cc]
        if message.bcc:
            payload['bcc'] = [{'email': addr} for addr in message.bcc]

        # Reply-To
        if message.reply_to:
            payload['replyTo'] = {'email': message.reply_to[0]}

        # Dispatch
        self._post_to_brevo(payload)

    def _post_to_brevo(self, payload: dict):
        """
        Make the raw HTTP POST to the Brevo API using only stdlib (no extra deps).
        Raises an exception on non-2xx responses so that send_messages can count
        failures correctly.
        """
        body = json.dumps(payload).encode('utf-8')
        headers = {
            'accept': 'application/json',
            'api-key': self.api_key,
            'content-type': 'application/json',
        }

        req = urllib.request.Request(
            self.BREVO_API_URL,
            data=body,
            headers=headers,
            method='POST',
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status not in (200, 201):
                    raw = resp.read().decode('utf-8', errors='replace')
                    raise RuntimeError(f'Brevo API returned HTTP {resp.status}: {raw}')
                logger.debug('[BREVO] Email sent to %s — HTTP %s', payload.get('to'), resp.status)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode('utf-8', errors='replace')
            raise RuntimeError(f'Brevo API error {exc.code}: {raw}') from exc
