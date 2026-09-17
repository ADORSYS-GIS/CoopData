import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useUploadFinancialStatement,
  useSubmissionFiles,
  useDeleteSingleFile,
} from "./useUpload";
import { getAccessToken } from "@/services/shared/authService";

vi.mock("@/services/shared/authService", () => ({
  getAccessToken: vi.fn(() => "mock-token"),
  isOfflineModeActive: vi.fn(() => false),
}));

vi.mock("@/lib/auth", () => ({
  useUserRole: vi.fn(() => "cooperative"),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useUpload Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("useUploadFinancialStatement", () => {
    it("uploads files successfully", async () => {
      const mockResponse = { message: "Upload success" };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useUploadFinancialStatement("sub-1"), { wrapper: createWrapper() });
      const file = new File(["dummy content"], "test.pdf", { type: "application/pdf" });
      
      result.current.mutate({ files: [file] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cooperative/financial-statement/upload"),
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer mock-token" },
        })
      );
    });

    it("handles upload error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid file type" }),
      } as Response);

      const { result } = renderHook(() => useUploadFinancialStatement("sub-1"), { wrapper: createWrapper() });
      const file = new File(["dummy"], "test.exe");
      
      result.current.mutate({ files: [file] });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Invalid file type");
    });
  });

  describe("useSubmissionFiles", () => {
    it("fetches submission files", async () => {
      const mockFiles = [{ id: "file-1", original_name: "test.pdf" }];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles,
      } as Response);

      const { result } = renderHook(() => useSubmissionFiles("sub-1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockFiles);
    });

    it("returns empty array when submissionId is undefined", async () => {
      const { result } = renderHook(() => useSubmissionFiles(undefined), { wrapper: createWrapper() });
      expect(result.current.data).toBeUndefined(); // disabled query
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("useDeleteSingleFile", () => {
    it("deletes a file successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useDeleteSingleFile("sub-1"), { wrapper: createWrapper() });
      result.current.mutate({ submissionId: "sub-1", fileId: "file-1" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cooperative/submissions/sub-1/files/file-1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("handles deletion error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Cannot delete" }),
      } as Response);

      const { result } = renderHook(() => useDeleteSingleFile("sub-1"), { wrapper: createWrapper() });
      result.current.mutate({ submissionId: "sub-1", fileId: "file-1" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Cannot delete");
    });
  });
});
