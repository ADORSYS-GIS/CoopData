import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { QuestionnaireWizard, type TemplateSection } from "../QuestionnaireWizard";

// ── Shared mock values (must be hoisted above the vi.mock factories) ─────────
const { TEST_SECTIONS, mutateAsync, navigate } = vi.hoisted(() => {
  // NOTE: the fields below deliberately do NOT set `required: true` — the wizard
  // must treat every field as mandatory regardless of the template flag.
  const sections: TemplateSection[] = [
    {
      id: "sec-1",
      title: "General Info",
      icon: "Building2",
      fields: [
        { key: "coop_name", label: "Cooperative Name", type: "text" },
        { key: "members", label: "Members", type: "number" },
      ],
    },
    {
      id: "sec-2",
      title: "Details",
      icon: "Users",
      fields: [
        { key: "region", label: "Region", type: "select", options: ["Manzini", "Hhohho"] },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
    },
  ];
  return {
    TEST_SECTIONS: sections,
    mutateAsync: vi.fn().mockResolvedValue({ id: "resp-1" }),
    navigate: vi.fn(),
  };
});

vi.mock("@/hooks/submissions/useQuestionnaire", () => ({
  useQuestionnaire: () => ({ data: null, isLoading: false }),
  useSaveQuestionnaire: () => ({
    mutateAsync,
    isPending: false,
    isError: false,
  }),
  useActiveTemplate: () => ({
    data: {
      id: "tpl-1",
      questionnaire_type: "financial",
      version: 1,
      label: "Financial Q",
      sections: TEST_SECTIONS,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-i18next", () => {
  const keysMap: Record<string, string> = {
    "questionnaire.select": "— Select —",
    "questionnaire.enterField": "Enter {{field}}...",
    "questionnaire.allFieldsRequired": "All fields are required",
    "questionnaire.requiredFieldsSection":
      "Please fill in all required fields in this section before continuing: {{fields}}",
    "questionnaire.cannotCompleteFields":
      "Cannot complete questionnaire. Please fill in the following required fields: {{fields}}",
    "questionnaire.sectionIndicator": "Section {{section}} of {{total}}: {{title}}",
    "questionnaire.loadingConfig": "Loading form configuration...",
    "questionnaire.financial": "Financial",
    "questionnaire.nonFinancial": "Non-Financial",
    "questionnaire.saveDraft": "Save Draft",
    "questionnaire.previous": "Previous",
    "questionnaire.saveNext": "Save & Next",
    "questionnaire.complete": "Complete",
    "questionnaire.saved": "Saved",
    "questionnaire.saving": "Saving…",
    "questionnaire.failedSave": "Failed to save",
    "questionnaire.noQuestionnaireFound": "No active questionnaire found",
    "questionnaire.goBack": "Go Back",
  };
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (options && Object.keys(options).length > 0) {
          // crude interpolation for {{placeholders}}
          let out = keysMap[key] ?? key;
          for (const [k, v] of Object.entries(options)) {
            out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
          }
          return out;
        }
        return keysMap[key] ?? key;
      },
    }),
  };
});

const renderWizard = () =>
  render(<QuestionnaireWizard submissionId="sub-1" questionnaireType="financial" />);

describe("QuestionnaireWizard field validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks Save & Next, toasts and focuses the first missing field when a field is omitted", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /Save & Next/i }));

    // Message listing the missing fields
    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all required fields in this section before continuing: Cooperative Name, Members",
    );
    // Cursor moves to the first omitted field
    expect(document.getElementById("field-coop_name")).toHaveFocus();
    // Missing fields get the error ring
    expect(document.getElementById("field-coop_name")).toHaveClass("border-danger/60");
    // We did NOT advance to the next section
    expect(screen.queryByLabelText(/Region/)).not.toBeInTheDocument();
  });

  it("clears the error ring once the user types into the flagged field", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /Save & Next/i }));
    const nameInput = document.getElementById("field-coop_name") as HTMLInputElement;
    expect(nameInput).toHaveClass("border-danger/60");

    fireEvent.change(nameInput, { target: { value: "Unity Coop" } });
    expect(nameInput).not.toHaveClass("border-danger/60");
  });

  it("advances to the next section after Save & Next when every field is filled", async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText(/Cooperative Name/), {
      target: { value: "Unity Coop" },
    });
    fireEvent.change(screen.getByLabelText(/Members/), { target: { value: "120" } });

    fireEvent.click(screen.getByRole("button", { name: /Save & Next/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        questionnaire_type: "financial",
        answers: { coop_name: "Unity Coop", members: 120 },
      });
    });
    // Next section is now rendered
    expect(screen.getByLabelText(/Region/)).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("jumps to the section with the first missing field when completing the questionnaire", async () => {
    renderWizard();

    // Fill section 1 fully
    fireEvent.change(screen.getByLabelText(/Cooperative Name/), {
      target: { value: "Unity Coop" },
    });
    fireEvent.change(screen.getByLabelText(/Members/), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: /Save & Next/i }));
    await waitFor(() => expect(screen.getByLabelText(/Region/)).toBeInTheDocument());

    // Leave section 2 empty and click Complete
    fireEvent.click(screen.getByRole("button", { name: /^Complete$/i }));

    expect(toast.error).toHaveBeenCalled();
    // Focus lands on the first missing field of the offending section
    await waitFor(() => {
      expect(document.getElementById("field-region")).toHaveFocus();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1); // only the section save, not a full submit
  });
});
