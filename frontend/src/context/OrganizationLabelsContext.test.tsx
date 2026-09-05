import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  OrganizationLabelsProvider,
  useOrganizationLabelsContext,
} from "./OrganizationLabelsContext";
import * as useOrganizationLabelsModule from "@/hooks/settings/useOrganizationLabels";

vi.mock("@/hooks/settings/useOrganizationLabels");

const mockLabels = [
  {
    key: "federation",
    label: "Umphakatsi",
    short_label: "Umph",
    plural_label: "Imiphakatsi",
    description: "Federation of cooperatives",
    icon: "building",
    translations: {
      en: { label: "Federation", short_label: "Fed", plural_label: "Federations" },
      fr: { label: "Fédération", short_label: "Féd", plural_label: "Fédérations" },
    },
  },
  {
    key: "cooperative",
    label: "Ikambihamblelwano",
    short_label: "Ikamb",
    plural_label: "Tikambihamblelwano",
    description: "Primary cooperative",
    icon: "users",
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return <OrganizationLabelsProvider>{children}</OrganizationLabelsProvider>;
}

describe("OrganizationLabelsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLabel", () => {
    it("returns translated label for current language", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const label = result.current.getLabel("federation", "label");
      expect(label).toBe("Federation");
    });

    it("returns default label when no translation exists", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const label = result.current.getLabel("cooperative", "label");
      expect(label).toBe("Ikambihamblelwano");
    });

    it("returns fallback when key not found", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: [] as unknown,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const label = result.current.getLabel("unknown", "label", "Default Label");
      expect(label).toBe("Default Label");
    });

    it("returns key as fallback when no fallback provided", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: [] as unknown,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const label = result.current.getLabel("unknown", "label");
      expect(label).toBe("unknown");
    });
  });

  describe("replaceOrgTerms", () => {
    it("replaces plural org terms in text", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const text = "All Federations must submit reports";
      const replaced = result.current.replaceOrgTerms(text);
      expect(replaced).toBe("All Federations must submit reports");
    });

    it("replaces singular org terms in text", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const text = "The Federation approved the submission";
      const replaced = result.current.replaceOrgTerms(text);
      expect(replaced).toBe("The Federation approved the submission");
    });

    it("handles empty string", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: [] as unknown,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const replaced = result.current.replaceOrgTerms("");
      expect(replaced).toBe("");
    });

    it("handles null/undefined gracefully", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: [] as unknown,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      const replaced = result.current.replaceOrgTerms(null as unknown as string);
      expect(replaced).toBeNull();
    });
  });

  describe("short labels", () => {
    it("provides fedShort, apexShort, coopShort, ministryShort", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: [] as unknown,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      expect(result.current.fedShort).toBe("Fed");
      expect(result.current.apexShort).toBe("Apex");
      expect(result.current.coopShort).toBe("Coop");
      expect(result.current.ministryShort).toBe("Min");
    });
  });

  describe("isLoading", () => {
    it("reflects loading state from useOrganizationLabels", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it("reflects loaded state", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("labels array", () => {
    it("provides labels from useOrganizationLabels", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: mockLabels,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      expect(result.current.labels).toEqual(mockLabels);
    });

    it("provides empty labels when data is undefined", () => {
      vi.mocked(useOrganizationLabelsModule.useOrganizationLabels).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as ReturnType<typeof useOrganizationLabelsModule.useOrganizationLabels>);

      const { result } = renderHook(() => useOrganizationLabelsContext(), { wrapper: Wrapper });

      expect(result.current.labels).toEqual([]);
    });
  });
});
