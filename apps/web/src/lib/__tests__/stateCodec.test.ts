import { describe, it, expect } from "vitest";
import { encodeGameState, decodeGameState } from "../stateCodec";

describe("stateCodec", () => {
  describe("encodeGameState", () => {
    it("encodes spin count and upgrades into base64 string", () => {
      const spinCount = 150000;
      const upgrades = {
        bearingUpgrade: 5,
        rgbMode: 3,
        gamblingMode: 2,
        stimulationMode: 1,
        autoSpin: 4,
        theoMode: 2,
        ftxMode: 1,
      };

      const encoded = encodeGameState(spinCount, upgrades);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
      // Should be valid base64
      expect(() => atob(encoded)).not.toThrow();
    });

    it("handles zero values", () => {
      const encoded = encodeGameState(0, {});

      expect(typeof encoded).toBe("string");
      const decoded = decodeGameState(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.spinCount).toBe(0);
    });

    it("handles missing upgrade keys by defaulting to 0", () => {
      const encoded = encodeGameState(1000, { bearingUpgrade: 3 });
      const decoded = decodeGameState(encoded);

      expect(decoded?.upgrades.bearingUpgrade).toBe(3);
      expect(decoded?.upgrades.rgbMode).toBe(0);
      expect(decoded?.upgrades.gamblingMode).toBe(0);
    });

    it("handles large spin counts", () => {
      const largeCount = 999999999;
      const encoded = encodeGameState(largeCount, {});
      const decoded = decodeGameState(encoded);

      expect(decoded?.spinCount).toBe(largeCount);
    });
  });

  describe("decodeGameState", () => {
    it("decodes valid encoded state", () => {
      const original = {
        spinCount: 50000,
        upgrades: {
          bearingUpgrade: 5,
          rgbMode: 2,
          gamblingMode: 3,
          stimulationMode: 1,
          autoSpin: 6,
          theoMode: 1,
          ftxMode: 0,
        },
      };

      const encoded = encodeGameState(original.spinCount, original.upgrades);
      const decoded = decodeGameState(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.spinCount).toBe(original.spinCount);
      expect(decoded?.upgrades.bearingUpgrade).toBe(5);
      expect(decoded?.upgrades.rgbMode).toBe(2);
      expect(decoded?.upgrades.gamblingMode).toBe(3);
      expect(decoded?.upgrades.stimulationMode).toBe(1);
      expect(decoded?.upgrades.autoSpin).toBe(6);
      expect(decoded?.upgrades.theoMode).toBe(1);
      expect(decoded?.upgrades.ftxMode).toBe(0);
    });

    it("returns null for invalid base64", () => {
      const result = decodeGameState("not-valid-base64!!!");
      expect(result).toBeNull();
    });

    it("returns null for valid base64 but invalid JSON", () => {
      const invalidJson = btoa("not json at all");
      const result = decodeGameState(invalidJson);
      expect(result).toBeNull();
    });

    it("returns null for tampered hash", () => {
      const encoded = encodeGameState(1000, { bearingUpgrade: 5 });
      // Decode, modify, re-encode without updating hash
      const payload = JSON.parse(atob(encoded));
      payload.s = 999999; // Tamper with spin count
      const tampered = btoa(JSON.stringify(payload));

      const result = decodeGameState(tampered);
      expect(result).toBeNull();
    });

    it("returns null for tampered upgrades", () => {
      const encoded = encodeGameState(1000, { bearingUpgrade: 1 });
      const payload = JSON.parse(atob(encoded));
      payload.u[0] = 99; // Tamper with upgrade level
      const tampered = btoa(JSON.stringify(payload));

      const result = decodeGameState(tampered);
      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = decodeGameState("");
      expect(result).toBeNull();
    });

    it("returns null for missing required fields", () => {
      const incomplete = btoa(JSON.stringify({ s: 100 })); // Missing u and h
      const result = decodeGameState(incomplete);
      expect(result).toBeNull();
    });
  });

  describe("round-trip encoding/decoding", () => {
    it("preserves all upgrade types through encode/decode cycle", () => {
      const upgrades = {
        bearingUpgrade: 5,
        rgbMode: 3,
        gamblingMode: 4,
        stimulationMode: 1,
        autoSpin: 8,
        theoMode: 3,
        ftxMode: 1,
      };

      const encoded = encodeGameState(100000, upgrades);
      const decoded = decodeGameState(encoded);

      expect(decoded?.upgrades).toEqual(upgrades);
    });

    it("handles edge case upgrade values", () => {
      const upgrades = {
        bearingUpgrade: 0,
        rgbMode: 0,
        gamblingMode: 0,
        stimulationMode: 0,
        autoSpin: 0,
        theoMode: 0,
        ftxMode: 0,
      };

      const encoded = encodeGameState(1, upgrades);
      const decoded = decodeGameState(encoded);

      expect(decoded?.spinCount).toBe(1);
      expect(decoded?.upgrades).toEqual(upgrades);
    });

    it("is deterministic - same input produces same output", () => {
      const spinCount = 12345;
      const upgrades = { bearingUpgrade: 3, rgbMode: 2 };

      const encoded1 = encodeGameState(spinCount, upgrades);
      const encoded2 = encodeGameState(spinCount, upgrades);

      expect(encoded1).toBe(encoded2);
    });
  });
});
