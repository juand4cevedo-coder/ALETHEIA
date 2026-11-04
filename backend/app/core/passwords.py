"""Contraseñas con Argon2id (RN-025, RNF-002).

Los parámetros son los mínimos que recomienda OWASP para Argon2id: 19 MiB de memoria, dos
pasadas y un hilo. Valores más altos ponen en riesgo los 512 MB del contenedor de la API cuando
llegan varios registros o ingresos a la vez (RT-007). Si algún día cambian, los hashes viejos
siguen verificando, porque cada uno guarda sus propios parámetros.
"""

import unicodedata
from typing import Final

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError

MIN_LENGTH: Final = 12
# El tope impide mandar textos enormes solo para gastar CPU en el hash.
MAX_LENGTH: Final = 128

_HASHER: Final = PasswordHasher(
    time_cost=2, memory_cost=19 * 1024, parallelism=1, hash_len=32, salt_len=16, type=Type.ID
)


def normalize(password: str) -> str:
    """La misma contraseña escrita en otro teclado o sistema produce los mismos caracteres.

    NFKC une, por ejemplo, una ñ compuesta (n más tilde) con la ñ de un solo carácter, como
    pide NIST SP 800-63B. La longitud de RN-025 se mide sobre este resultado.
    """
    return unicodedata.normalize("NFKC", password)


def hash_password(password: str) -> str:
    """Hash Argon2id en formato PHC, con su sal y sus parámetros."""
    return _HASHER.hash(normalize(password))


def verify_password(password_hash: str, password: str) -> bool:
    """Compara en tiempo constante. Un hash dañado o ajeno cuenta como contraseña incorrecta."""
    try:
        return _HASHER.verify(password_hash, normalize(password))
    # ValueError cubre InvalidHashError y también un hash con caracteres fuera de ASCII, que
    # argon2 rechaza con UnicodeEncodeError: ninguno de los dos debe terminar en un error 500.
    except VerificationError, ValueError:
        return False
