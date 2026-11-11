import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChainStrip } from "./ChainStrip.tsx";

function diamonds(strip: HTMLElement): HTMLElement[] {
  return Array.from(strip.querySelectorAll<HTMLElement>("[data-action]"));
}

describe("ChainStrip", () => {
  it("dibuja un rombo por acción y describe los eventos en español", () => {
    render(
      <ChainStrip
        actions={[
          "case_created",
          "member_added",
          "evidence_uploaded",
          "evidence_stamped",
          "evidence_downloaded",
        ]}
      />,
    );

    const strip = screen.getByRole("img", {
      name: "Últimos 5 eventos: Caso creado, Miembro agregado, Evidencia subida, Sello de tiempo obtenido, Original descargado",
    });
    expect(diamonds(strip)).toHaveLength(5);
    expect(strip.querySelector("[data-pending]")).toBeNull();
  });

  it("con un solo evento lo dice en singular", () => {
    render(<ChainStrip actions={["case_created"]} />);

    expect(
      screen.getByRole("img", { name: "Último evento: Caso creado" }),
    ).toBeInTheDocument();
  });

  it("marca en ámbar una evidencia subida que todavía no tiene sello", () => {
    render(
      <ChainStrip
        actions={["case_created", "evidence_uploaded", "evidence_downloaded"]}
      />,
    );

    const strip = screen.getByRole("img", {
      name: "Últimos 3 eventos: Caso creado, Evidencia subida (sello de tiempo pendiente), Original descargado",
    });
    const pending = strip.querySelectorAll("[data-pending]");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toHaveAttribute("data-action", "evidence_uploaded");
  });

  it("una evidencia con su sello o su fallo después no queda pendiente", () => {
    render(
      <ChainStrip
        actions={[
          "evidence_uploaded",
          "evidence_stamped",
          "evidence_uploaded",
          "evidence_stamp_failed",
        ]}
      />,
    );

    expect(screen.getByRole("img").querySelector("[data-pending]")).toBeNull();
  });

  it("una acción sin nombre conocido se muestra con su código", () => {
    render(<ChainStrip actions={["something_new"]} />);

    expect(
      screen.getByRole("img", { name: "Último evento: something_new" }),
    ).toBeInTheDocument();
  });

  it("sin eventos lo dice", () => {
    render(<ChainStrip actions={[]} />);

    const strip = screen.getByRole("img", { name: "Sin eventos registrados" });
    expect(diamonds(strip)).toHaveLength(0);
  });
});
