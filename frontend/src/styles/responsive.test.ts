import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const css = (path: string) => readFileSync(join(SRC, path), "utf8");

describe("contrato responsive", () => {
  it("impide que redondeos o elementos decorativos desborden la página", () => {
    const global = css("styles/global.css");
    expect(global.match(/overflow-x:\s*clip/g)).toHaveLength(2);
  });

  it("permite que los campos con controles internos se encojan", () => {
    const field = css("components/ui/Field.module.css");
    const control = field.match(/\.control\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(control).toMatch(/width:\s*100%/);
    expect(control).toMatch(/min-width:\s*0/);
  });

  it("mantiene la navegación de documentación dentro del viewport", () => {
    const documentation = css("pages/DocumentationPage.module.css");
    expect(documentation).toMatch(
      /\.sidebar,\s*\.contents\s*\{[^}]*min-width:\s*0/s,
    );
    expect(documentation).toMatch(
      /\.sidebar nav\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%[^}]*min-width:\s*0/s,
    );
  });

  it("reordena las superficies operativas en móvil y tablet", () => {
    const platform = css("pages/PlatformPage.module.css");
    const newCase = css("pages/NewCasePage.module.css");
    const taskSection = css("features/cases/TaskSection.module.css");
    const dialog = css("components/ui/Dialog.module.css");

    expect(platform).toMatch(
      /@container \(max-width: 1040px\)[\s\S]*\.table[\s\S]*display:\s*block/,
    );
    expect(platform).toMatch(
      /@container \(max-width: 680px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(newCase).toMatch(
      /@media \(max-width: 900px\)[\s\S]*\.compose[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(taskSection).toMatch(
      /@media \(max-width: 700px\)[\s\S]*\.filters,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog).toMatch(
      /@media \(max-width: 560px\)[\s\S]*\.dialog[\s\S]*width:\s*100%[\s\S]*max-height:\s*92dvh[\s\S]*translateY\(100%\)/,
    );
  });
});
