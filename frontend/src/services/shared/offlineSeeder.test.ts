import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { seedOfflineCache } from "./offlineSeeder";
import { apiClient } from "@/openapi-client";
import { cacheSet } from "./offlineCache";
import { getUserProfile, fetchWithAuth } from "./authService";

// Mock the dependencies
vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
  },
}));

vi.mock("./offlineCache", () => ({
  cacheSet: vi.fn(),
}));

vi.mock("./authService", () => ({
  getUserProfile: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

describe("offlineSeeder", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Save original navigator state
    originalOnLine = navigator.onLine;
    
    // Mock default successful API responses
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [] } as any);
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    } as any);
  });

  afterEach(() => {
    // Restore navigator state
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
    });
  });

  describe("Short-circuits & Guards", () => {
    it("should return immediately if navigator is offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true });
      
      await seedOfflineCache();
      
      expect(getUserProfile).not.toHaveBeenCalled();
      expect(apiClient.GET).not.toHaveBeenCalled();
    });

    it("should return immediately if user profile is null", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, writable: true });
      vi.mocked(getUserProfile).mockReturnValue(null);
      
      await seedOfflineCache();
      
      expect(apiClient.GET).not.toHaveBeenCalled();
    });
  });

  describe("Error Resilience (safeFetch)", () => {
    it("should continue executing subsequent endpoints if one fails", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, writable: true });
      vi.mocked(getUserProfile).mockReturnValue({ id: "123", role: "cooperative" } as any);
      
      // Force the first API call (submissions list) to reject
      vi.mocked(apiClient.GET).mockRejectedValueOnce(new Error("Network Error"));
      // The second call (e.g. non-financial catalog) should still succeed
      vi.mocked(apiClient.GET).mockResolvedValue({ data: [{ dummy: 1 }] } as any);

      await seedOfflineCache();

      // cacheSet should still have been called for the endpoints that didn't fail
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe("Role-Based Execution Branches", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    });

    it("should fetch and cache ministry-specific endpoints", async () => {
      vi.mocked(getUserProfile).mockReturnValue({ id: "min-1", role: "ministry" } as any);
      
      await seedOfflineCache();
      
      // Verify specific ministry calls
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/ministry/submissions", expect.anything());
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/ministry/stats");
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/ministry/audit-logs", expect.anything());
    });

    it("should fetch and cache federation-specific endpoints", async () => {
      vi.mocked(getUserProfile).mockReturnValue({ id: "fed-1", role: "federation" } as any);
      
      await seedOfflineCache();
      
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/federation/submissions", expect.anything());
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/federation/stats");
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/federation/apexes", expect.anything());
    });

    it("should fetch and cache apex-specific endpoints", async () => {
      vi.mocked(getUserProfile).mockReturnValue({ id: "apx-1", role: "apex" } as any);
      
      // Provide some dummy cooperatives so the loops execute
      vi.mocked(apiClient.GET).mockImplementation(async (url: string) => {
        if (url === "/api/v1/apex/cooperatives") {
          return { data: [{ id: "coop-a" }] } as any;
        }
        return { data: [] } as any;
      });

      await seedOfflineCache();
      
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/apex/submissions", expect.anything());
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/apex/stats");
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/apex/cooperatives", expect.anything());
      // Should loop over the dummy cooperative
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/apex/cooperatives/{id}", { params: { path: { id: "coop-a" } } });
    });

    it("should fetch and cache cooperative-specific endpoints", async () => {
      vi.mocked(getUserProfile).mockReturnValue({ id: "coop-1", role: "cooperative" } as any);
      
      await seedOfflineCache();
      
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions", expect.anything());
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/stats");
      expect(fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining("/api/v1/cooperative/profile"));
    });
  });

  describe("Dynamic Data Looping (Submissions)", () => {
    it("should loop through submissions and fetch their details", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, writable: true });
      vi.mocked(getUserProfile).mockReturnValue({ id: "coop-1", role: "cooperative" } as any);
      
      // Mock the initial submissions list to return two submissions
      // One has a financial_statement_id, one doesn't.
      vi.mocked(apiClient.GET).mockImplementation(async (url: string) => {
        if (url === "/api/v1/cooperative/submissions") {
          return {
            data: [
              { id: "sub-1", financial_statement_id: "fs-1" },
              { id: "sub-2" } // no financial statement
            ]
          } as any;
        }
        return { data: [] } as any;
      });

      await seedOfflineCache();

      // Detail endpoint should be called for BOTH submissions
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions/{id}", { params: { path: { id: "sub-1" } } });
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions/{id}", { params: { path: { id: "sub-2" } } });

      // Sections endpoint should be called for BOTH
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions/{id}/sections", { params: { path: { id: "sub-1" } } });
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions/{id}/sections", { params: { path: { id: "sub-2" } } });

      // Financial statement endpoint should ONLY be called for sub-1
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/financial-statements/{id}", { params: { path: { id: "fs-1" } } });
      expect(apiClient.GET).not.toHaveBeenCalledWith("/api/v1/cooperative/financial-statements/{id}", { params: { path: { id: undefined } } });
    });
  });
});
