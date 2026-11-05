"""Pruebas del hash de contraseñas con Argon2id."""

import datetime

import pytest
from argon2 import PasswordHasher, Type
from psycopg.errors import CheckViolation
from sqlalchemy.orm import Session

from app.core.passwords import (
    MAX_LENGTH,
    MIN_LENGTH,
    check_password,
    hash_password,
    needs_rehash,
    normalize,
    verify_password,
)
from app.models import User
from tests.conftest import rejected

_CLAVE = "una frase larga y fácil de recordar"


def test_el_hash_es_argon2id_con_los_parametros_de_owasp() -> None:
    assert hash_password(_CLAVE).startswith("$argon2id$v=19$m=19456,t=2,p=1$")


def test_la_contrasena_correcta_verifica_y_otra_no() -> None:
    password_hash = hash_password(_CLAVE)

    assert verify_password(password_hash, _CLAVE) is True
    assert verify_password(password_hash, _CLAVE + " ") is False


def test_cada_hash_lleva_su_propia_sal() -> None:
    assert hash_password(_CLAVE) != hash_password(_CLAVE)


def test_la_misma_contrasena_escrita_de_otra_forma_verifica() -> None:
    # "contraseña" con la ñ de un solo carácter y con n más la tilde combinable.
    compuesta = "contraseña segura"
    descompuesta = "contrasen\u0303a segura"
    assert compuesta != descompuesta

    assert verify_password(hash_password(compuesta), descompuesta) is True


@pytest.mark.parametrize("password_hash", ["", "texto", "$argon2id$dañado", "$2b$12$bcrypt"])
def test_un_hash_danado_o_ajeno_no_verifica(password_hash: str) -> None:
    assert verify_password(password_hash, _CLAVE) is False


def test_los_limites_de_longitud_son_los_de_rn_025() -> None:
    assert (MIN_LENGTH, MAX_LENGTH) == (12, 128)
    assert len(normalize("contrasen\u0303a")) == len("contraseña")


def _user(email: str, password_hash: str) -> User:
    return User(
        email=email,
        password_hash=password_hash,
        full_name="Ana",
        terms_version="1.0",
        privacy_version="1.0",
        consented_at=datetime.datetime.now(datetime.UTC),
    )


def test_la_base_guarda_el_hash_y_rechaza_una_contrasena_en_claro(db: Session) -> None:
    db.add(_user("ana@example.com", hash_password(_CLAVE)))
    db.flush()

    with rejected(db, CheckViolation):
        db.add(_user("otra@example.com", _CLAVE))


def test_sin_hash_la_comprobacion_falla_aunque_coincida_con_el_senuelo() -> None:
    assert check_password(None, _CLAVE) is False
    assert check_password(None, "señuelo de ALETHEIA para igualar los tiempos") is False


def test_con_hash_la_comprobacion_es_la_de_siempre() -> None:
    password_hash = hash_password(_CLAVE)

    assert check_password(password_hash, _CLAVE) is True
    assert check_password(password_hash, "otra frase larga y distinta") is False


def test_solo_un_hash_con_otros_parametros_pide_rehacerse() -> None:
    viejo = PasswordHasher(time_cost=1, memory_cost=8 * 1024, parallelism=1, type=Type.ID)

    assert needs_rehash(hash_password(_CLAVE)) is False
    assert needs_rehash(viejo.hash(_CLAVE)) is True
    # Un hash dañado no se rehace aquí: simplemente no verifica.
    assert needs_rehash("no es un hash") is False
