import { scrapeClientId } from "./scapper-client-id";

describe("scrapeClientId", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns a client ID from HTML", async () => {
    const mockClientId = "a".repeat(32);

    globalThis.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => `<html>{"client_id":"${mockClientId}"}</html>`,
      } as unknown as Response;
    });

    const clientId = await scrapeClientId();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://soundcloud.com/discover",
      expect.any(Object),
    );
    expect(clientId).toBe(mockClientId);
  });
});
