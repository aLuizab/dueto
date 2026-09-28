import { describe, expect, it } from "vitest";
import { evaluateExpression, parseValueField } from "../expression";

describe("expression", () => {
  it("avalia soma simples como na planilha", () => {
    expect(parseValueField("=120+150")).toEqual({ value: 270, expression: "=120+150" });
  });
  it("avalia soma longa com decimais", () => {
    expect(parseValueField("=13.35+132.31+34.68+99.08+90.86+118.69+3.5").value).toBe(492.47);
  });
  it("avalia subtração e parênteses", () => {
    expect(parseValueField("=3676.06-88.81-125").value).toBe(3462.25);
    expect(parseValueField("=(2500+325)-825").value).toBe(2000);
  });
  it("suporta SUM/SOMA", () => {
    expect(parseValueField("=SUM(25598+6123+1600)").value).toBe(33321);
    expect(parseValueField("=soma(1;2;3)").value).toBe(6);
  });
  it("aceita vírgula decimal pt-BR e R$", () => {
    expect(parseValueField("1.234,56").value).toBe(1234.56);
    expect(parseValueField("R$ 45,90").value).toBe(45.9);
    expect(parseValueField("=1.234,56+0,44").value).toBe(1235);
  });
  it("trata vazio e traço como zero", () => {
    expect(parseValueField("-").value).toBe(0);
    expect(parseValueField("").value).toBe(0);
    expect(parseValueField(null).value).toBe(0);
  });
  it("número puro", () => {
    expect(parseValueField(87)).toEqual({ value: 87, expression: null });
  });
  it("rejeita expressões inválidas", () => {
    expect(() => evaluateExpression("1+")).toThrow();
    expect(() => evaluateExpression("abc(1)")).toThrow();
    expect(() => evaluateExpression("1/0")).toThrow();
    expect(() => parseValueField("=alert(1)")).toThrow();
  });
  it("multiplicação e divisão com precedência", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("(2+3)*4")).toBe(20);
    expect(evaluateExpression("10/4")).toBe(2.5);
    expect(evaluateExpression("-5+10")).toBe(5);
  });
});
