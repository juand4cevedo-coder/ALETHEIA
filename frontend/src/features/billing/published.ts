import type { PublicPlan } from "../../api/generated";
import publicado from "./catalogo-publicado.json";

// Copia del catálogo público (GET /api/v1/plans) que viaja con el sitio. Con ella el HTML que se
// arma al construir ya trae las tarjetas con sus precios, y los buscadores y los motores de
// respuesta las leen sin ejecutar JavaScript. Al abrir la página, la API la reemplaza. Una prueba
// del backend (tests/test_plans.py) compara esta copia con la API, así que no puede quedar vieja.
export const CATALOGO_PUBLICADO: readonly PublicPlan[] = publicado;
