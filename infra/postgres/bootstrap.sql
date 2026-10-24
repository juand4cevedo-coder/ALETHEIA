-- Usuarios de ALETHEIA en PostgreSQL.

-- Lo ejecuta una sola vez un administrador, conectado a la base de la aplicación y antes de
-- la primera migración. Las claves llegan por variables de entorno, nunca escritas aquí.
-- En desarrollo lo ejecuta el contenedor en su primer arranque (infra/postgres/initdb).
-- Los permisos sobre tablas y funciones no se definen aquí: los fijan las migraciones.

\set ON_ERROR_STOP on
\getenv owner_password ALETHEIA_OWNER_PASSWORD
\getenv app_password ALETHEIA_APP_PASSWORD
\getenv support_password ALETHEIA_SUPPORT_PASSWORD
SELECT current_database() AS db \gset

-- Dueño del esquema: solo las migraciones se conectan con él.
CREATE ROLE aletheia_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
    PASSWORD :'owner_password';

-- Aplicación: la API y el trabajador leen y escriben datos, pero no cambian el esquema.
CREATE ROLE aletheia_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
    PASSWORD :'app_password';

-- Soporte: consultas de solo lectura.
CREATE ROLE aletheia_support LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
    PASSWORD :'support_password';

-- Solo estos tres usuarios y el administrador se conectan a la base; nadie más crea
-- tablas temporales en ella.
REVOKE CONNECT, TEMPORARY ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO aletheia_owner, aletheia_app, aletheia_support;

-- Desde PostgreSQL 15 nadie crea objetos en public sin permiso: solo el dueño lo recibe.
GRANT CREATE ON SCHEMA public TO aletheia_owner;
