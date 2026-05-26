import {
  normalizeComponentPickerCategorySettings,
  type ComponentPickerCategorySettings,
} from "#content/app/utils/component-picker-categories";
import { ref } from "vue";

type ComponentPickerCategorySettingsResponse = {
  success?: boolean;
  settings?: unknown;
};

const sharedSettings = ref<ComponentPickerCategorySettings>(
  normalizeComponentPickerCategorySettings(null),
);
const sharedLoading = ref(false);
const sharedSaving = ref(false);
const sharedError = ref<string | null>(null);
const sharedAvailable = ref(false);

export const useComponentPickerCategories = () => {
  const settings = sharedSettings;
  const loading = sharedLoading;
  const saving = sharedSaving;
  const error = sharedError;
  const available = sharedAvailable;

  const syncFromResponse = (
    response: ComponentPickerCategorySettingsResponse | null | undefined,
  ) => {
    if (response?.success !== true) {
      return;
    }
    settings.value = normalizeComponentPickerCategorySettings(response.settings);
    available.value = true;
  };

  const fetchAdmin = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response =
        await $fetch<ComponentPickerCategorySettingsResponse>(
          "/api/content/component-picker-categories/admin",
        );
      syncFromResponse(response);
      return settings.value;
    } catch (requestError: any) {
      available.value = false;
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to load component picker categories.";
      return null;
    } finally {
      loading.value = false;
    }
  };

  const saveAdmin = async (payload: ComponentPickerCategorySettings) => {
    saving.value = true;
    error.value = null;
    try {
      const response =
        await $fetch<ComponentPickerCategorySettingsResponse>(
          "/api/content/component-picker-categories/admin",
          {
            method: "PUT",
            body: { settings: payload },
          },
        );
      syncFromResponse(response);
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to save component picker categories.";
      throw requestError;
    } finally {
      saving.value = false;
    }
  };

  return {
    settings,
    loading,
    saving,
    error,
    available,
    fetchAdmin,
    saveAdmin,
  };
};
