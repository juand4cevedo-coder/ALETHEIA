"""Esquemas del catálogo público de planes (API-002)."""

from pydantic import BaseModel, Field


class PublicPlan(BaseModel):
    """Plan que se muestra en la página de precios, con sus precios y límites del catálogo."""

    code: str = Field(description="Código estable del plan, por ejemplo essential.")
    name: str = Field(description="Nombre comercial del plan.")
    monthly_price_cop: int = Field(
        description="Precio mensual en pesos colombianos; 0 si es gratis."
    )
    annual_price_cop: int | None = Field(
        description="Precio del pago anual en pesos; nulo si el plan no se vende por año."
    )
    included_users: int = Field(description="Usuarios incluidos en el precio.")
    extra_user_price_cop: int | None = Field(
        description="Precio mensual de cada usuario adicional; nulo si el plan no los admite."
    )
    storage_limit_bytes: int = Field(description="Almacenamiento total del plan, en bytes.")
    max_file_bytes: int = Field(description="Tamaño máximo de un archivo, en bytes.")
    trial_days: int | None = Field(
        description="Días de duración si el plan es la prueba gratuita; nulo en los demás."
    )
