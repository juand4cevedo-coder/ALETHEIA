"""Pruebas del diseño común de los correos."""

from app.services.email_layout import email_layout


def _correo(**cambios: str) -> str:
    return email_layout(
        "Hola:",
        ["Un párrafo."],
        (cambios.get("etiqueta", "Verificar mi correo"), cambios.get("enlace", "https://x.test/a")),
        "Cierre.",
        site_url="https://aletheia.sbs",
    )


def test_el_logo_sale_de_una_ruta_publica_del_sitio() -> None:
    assert 'src="https://aletheia.sbs/email/logo-claro.png"' in _correo()


def test_el_boton_escapa_la_etiqueta_y_el_enlace() -> None:
    correo = _correo(etiqueta="<b>x</b>", enlace='https://x.test/?a=1&b="2"')

    assert "<b>x</b>" not in correo
    assert "&lt;b&gt;x&lt;/b&gt;" in correo
    assert "&amp;b=&quot;2&quot;" in correo


def test_el_correo_es_claro_con_fuentes_del_sistema_y_sin_adornos() -> None:
    correo = _correo()

    assert "background:#5544D8" in correo
    assert "Segoe UI" in correo
    assert "gradient" not in correo
    assert "shadow" not in correo
    assert not any(c in correo for c in "·—…")
