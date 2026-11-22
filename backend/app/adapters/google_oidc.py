"""Cliente mínimo de OpenID Connect para Google, con Authorization Code y PKCE."""

import base64
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Final, Protocol

import jwt

from app.core.config import Settings

_AUTHORIZE: Final = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_ENDPOINT: Final = "https://oauth2.googleapis.com/token"  # noqa: S105 -- URL, no secreto
_JWKS: Final = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS: Final = ("https://accounts.google.com", "accounts.google.com")


class GoogleOidcError(Exception):
    """Google rechazó el código o el ID token no demuestra una identidad válida."""


class GoogleOidcUnavailableError(Exception):
    """El despliegue todavía no tiene credenciales de Google."""


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    subject: str
    email: str
    email_verified: bool
    full_name: str


class GoogleOidc(Protocol):
    def authorization_url(self, *, state: str, nonce: str, code_challenge: str) -> str: ...

    def exchange(self, *, code: str, code_verifier: str, nonce: str) -> GoogleIdentity: ...


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class GoogleOidcClient:
    def __init__(self, *, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self.client_id = client_id
        self._client_secret = client_secret
        self.redirect_uri = redirect_uri
        self._jwks = jwt.PyJWKClient(_JWKS, cache_keys=True, lifespan=300, timeout=5)

    @classmethod
    def from_settings(cls, settings: Settings) -> GoogleOidcClient:
        if settings.google_client_id is None or settings.google_client_secret is None:
            raise GoogleOidcUnavailableError
        return cls(
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret.get_secret_value(),
            redirect_uri=settings.google_callback_url,
        )

    def authorization_url(self, *, state: str, nonce: str, code_challenge: str) -> str:
        query = urllib.parse.urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "nonce": nonce,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
                "prompt": "select_account",
            }
        )
        return f"{_AUTHORIZE}?{query}"

    def exchange(self, *, code: str, code_verifier: str, nonce: str) -> GoogleIdentity:
        body = urllib.parse.urlencode(
            {
                "code": code,
                "client_id": self.client_id,
                "client_secret": self._client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            }
        ).encode()
        request = urllib.request.Request(
            _TOKEN_ENDPOINT,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:  # noqa: S310
                raw = response.read(32_768)
            payload = json.loads(raw)
            id_token = payload["id_token"]
            signing_key = self._jwks.get_signing_key_from_jwt(id_token)
            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=_ISSUERS,
                options={
                    "require": [
                        "iss",
                        "aud",
                        "sub",
                        "iat",
                        "exp",
                        "nonce",
                        "email",
                        "email_verified",
                        "name",
                    ]
                },
            )
            if claims["nonce"] != nonce or claims["email_verified"] is not True:
                raise GoogleOidcError
            subject = str(claims["sub"])
            email = str(claims["email"])
            full_name = str(claims["name"]).strip()
            if (
                not 1 <= len(subject) <= 255
                or not 3 <= len(email) <= 254
                or "@" not in email
                or not 1 <= len(full_name) <= 120
            ):
                raise GoogleOidcError
            return GoogleIdentity(
                subject=subject,
                email=email,
                email_verified=True,
                full_name=full_name,
            )
        except (
            GoogleOidcError,
            KeyError,
            TypeError,
            ValueError,
            json.JSONDecodeError,
            jwt.PyJWTError,
            urllib.error.URLError,
        ):
            raise GoogleOidcError from None
