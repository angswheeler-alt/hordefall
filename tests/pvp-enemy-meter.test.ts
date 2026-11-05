import { describe, expect, it } from "vitest";
import Decimal from "break_infinity.js";
import scene from "../src/BattleScene.ts?raw";
import ui from "../src/ui.ts?raw";
import {
  addToMeter,
  meterRow,
  meterTops,
  type FightMeter,
} from "../src/battleMeter";

// Samuel (2026-11-05): fights against other players show each enemy hero's damage too.
const fight = (): FightMeter => ({
  meter: new Map([["a", meterRow("a")]]),
  foeMeter: meterRow("foes"),
  foeRows: new Map([
    ["x", meterRow("x")],
    ["y", meterRow("y")],
  ]),
});

describe("enemy heroes on the battle meter", () => {
  it("a foe hit counts on its own line and on the team total", () => {
    const m = fight();
    addToMeter(
      m,
      { side: "enemy", def: { id: "x" } },
      "dealt",
      new Decimal(30),
    );
    addToMeter(
      m,
      { side: "enemy", def: { id: "y" } },
      "dealt",
      new Decimal(12),
    );
    addToMeter(m, { side: "enemy", def: { id: "y" } }, "taken", new Decimal(5));
    expect(m.foeRows!.get("x")!.dealt.toNumber()).toBe(30);
    expect(m.foeRows!.get("y")!.dealt.toNumber()).toBe(12);
    expect(m.foeRows!.get("y")!.taken.toNumber()).toBe(5);
    expect(m.foeMeter.dealt.toNumber()).toBe(42);
    expect(m.meter.get("a")!.dealt.toNumber()).toBe(0);
  });

  it("the player hero with the same id as a foe keeps a separate line", () => {
    const m = fight();
    m.meter.set("x", meterRow("x"));
    addToMeter(m, { side: "hero", def: { id: "x" } }, "healed", new Decimal(7));
    expect(m.meter.get("x")!.healed.toNumber()).toBe(7);
    expect(m.foeRows!.get("x")!.healed.toNumber()).toBe(0);
    expect(m.foeMeter.healed.toNumber()).toBe(0);
  });

  it("a boss with no hero (Trials) still adds to the totals", () => {
    const m: FightMeter = { meter: new Map(), foeMeter: meterRow("boss") };
    addToMeter(m, { side: "enemy" }, "taken", new Decimal(9));
    addToMeter(m, { side: "enemy" }, "taken", new Decimal(0));
    expect(m.foeMeter.taken.toNumber()).toBe(9);
  });

  it("both teams share one bar scale", () => {
    const a = meterRow("a");
    const x = meterRow("x");
    a.dealt = new Decimal(10);
    x.dealt = new Decimal(40);
    expect(meterTops([a, x]).dealt.toNumber()).toBe(40);
  });

  it("every PvP fight sets up a line per enemy hero and the meter shows them", () => {
    expect(scene).toContain(
      "foeRows: new Map(foes.map((f) => [f.def.id, meterRow(f.def.id)]))",
    );
    expect(scene).toContain("addToMeter(p, unit, kind, amount)");
    expect(ui).toContain("Enemy heroes");
    expect(ui).toContain("m.foeRows.map((r) => line(r, true))");
  });
});
