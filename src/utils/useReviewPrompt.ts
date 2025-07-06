import { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { REVIEW_PROMPT_KEY } from "../constants";

export interface ReviewPromptData {
  installDate: number;
  lastShownDate: number;
  userReviewed: boolean;
  dismissed: boolean;
}

const useReviewPrompt = () => {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkShouldShowPrompt = async () => {
    try {
      const data = await browser.storage.sync.get(REVIEW_PROMPT_KEY);
      const now = Date.now();
      
      let reviewData: ReviewPromptData | undefined = data[REVIEW_PROMPT_KEY] as ReviewPromptData;
      
      // If no data exists, this is a first-time user
      if (!reviewData) {
        const newData: ReviewPromptData = {
          installDate: now,
          lastShownDate: 0,
          userReviewed: false,
          dismissed: false,
        };
        
        await browser.storage.sync.set({ [REVIEW_PROMPT_KEY]: newData });
        setShouldShow(false);
        setLoading(false);
        return;
      }
      
      // Don't show if user already reviewed
      if (reviewData.userReviewed) {
        setShouldShow(false);
        setLoading(false);
        return;
      }
      
      // Check if user has been using extension for at least 3 days
      const daysSinceInstall = (now - reviewData.installDate) / (1000 * 60 * 60 * 24);
      if (daysSinceInstall < 3) {
        setShouldShow(false);
        setLoading(false);
        return;
      }
      
      // Check if prompt was shown in the last month
      const daysSinceLastShown = (now - reviewData.lastShownDate) / (1000 * 60 * 60 * 24);
      if (reviewData.lastShownDate > 0 && daysSinceLastShown < 30) {
        setShouldShow(false);
        setLoading(false);
        return;
      }
      
      // All conditions met - show the prompt
      setShouldShow(true);
      setLoading(false);
    } catch (error) {
      console.error("Error checking review prompt:", error);
      setLoading(false);
    }
  };

  const hidePrompt = () => {
    setShouldShow(false);
  };

  useEffect(() => {
    checkShouldShowPrompt();
  }, []);

  return {
    shouldShow,
    loading,
    hidePrompt,
  };
};

export default useReviewPrompt;