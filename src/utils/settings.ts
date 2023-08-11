import { useEffect, useState } from "react";

export type HeaderSetting = {
  headerName: string;
  headerValue: string;
  headerEnabled: boolean;
};

function useFlexHeaderSettings() {
  const [settings, setSettings] = useState<HeaderSetting[]>([]);

  const retrieveSettings = async () => {
    chrome.storage.sync.get("settings", (data) => {
      setSettings(data.settings);
    });
  };

  const updateSettings = async (settings: HeaderSetting[]) => {
    chrome.storage.sync.set({ settings });
    setSettings(settings);
  };

  useEffect(() => {
    retrieveSettings();
  }, []);

  return { settings, updateSettings };
}

export default useFlexHeaderSettings;
