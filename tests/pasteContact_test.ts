// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { parsePastedContact } from "../src/app/pasteContact.ts";

describe("parsePastedContact", () => {
  it("splits a `Name <email>` mailbox into name and address", () => {
    expect(
      parsePastedContact("Firstname Lastname <firstname.lastname@gmail.com>"),
    ).toEqual({
      firstName: "Firstname",
      lastName: "Lastname",
      email: "firstname.lastname@gmail.com",
    });
  });

  it("keeps every leading token as the first name", () => {
    expect(parsePastedContact("Ada King Lovelace <ada@example.com>")).toEqual({
      firstName: "Ada King",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
  });

  it("treats a lone token as a first name with no last name", () => {
    expect(parsePastedContact("Cher <cher@example.com>")).toEqual({
      firstName: "Cher",
      lastName: "",
      email: "cher@example.com",
    });
  });

  it("strips surrounding quotes a mail client wraps the name in", () => {
    expect(parsePastedContact('"Ada Lovelace" <ada@example.com>')).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
  });

  it("accepts a bare address, filing it with no name", () => {
    expect(parsePastedContact("bob@example.com")).toEqual({
      firstName: "",
      lastName: "",
      email: "bob@example.com",
    });
  });

  it("accepts an angle-bracketed address with no display name", () => {
    expect(parsePastedContact("<bob@example.com>")).toEqual({
      firstName: "",
      lastName: "",
      email: "bob@example.com",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parsePastedContact("   Ada Lovelace <ada@example.com>   ")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
  });

  it("keeps plus-addressing and dots in the local part", () => {
    expect(
      parsePastedContact("Grace <grace+contacts@sub.example.co.uk>"),
    ).toEqual({
      firstName: "Grace",
      lastName: "",
      email: "grace+contacts@sub.example.co.uk",
    });
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["hello world", "plain prose"],
    ["not an email <nope>", "bracketed non-address"],
    ["Ada Lovelace <ada at example.com>", "address with a space"],
    ["call me on +46 70 123 45 67", "a phone number"],
    ["https://example.com/ada", "a URL"],
    ["a@b.com\nc@d.com", "multiple lines"],
  ])("rejects %j (%s)", (input) => {
    expect(parsePastedContact(input)).toBeNull();
  });
});
