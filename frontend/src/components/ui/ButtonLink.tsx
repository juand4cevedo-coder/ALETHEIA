import { Link, type LinkProps } from "react-router";

import { buttonClassName, type ButtonStyleOptions } from "./buttonStyles.ts";

type ButtonLinkProps = Omit<LinkProps, "className"> & ButtonStyleOptions;

// Enlace interno con apariencia de botón. Para navegar se usa un enlace, nunca un <button>
// (CMP-UI-001, uso incorrecto: navegar a otra página).
export function ButtonLink({
  variant,
  surface,
  size,
  ...linkProps
}: ButtonLinkProps) {
  return (
    <Link
      {...linkProps}
      className={buttonClassName({ variant, surface, size })}
    />
  );
}
