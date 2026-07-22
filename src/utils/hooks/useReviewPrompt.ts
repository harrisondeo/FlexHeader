import { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import {
  REVIEW_PROMPT_KEY,
  REVIEW_PROMPT_MIN_DAYS_SINCE_INSTALL,
  REVIEW_PROMPT_DISMISS_COOLDOWN_DAYS,
  REVIEW_PROMPT_ENGAGEMENT_HEADER_THRESHOLD,
  REVIEWS_URL,
} from "../../constants";

export interface ReviewPromptData {
  installDate: number;
  lastShownDate: number;
  userReviewed: boolean;
  dismissed: boolean;
  // Set once a strong engagement signal (see notifyPositiveAction) is seen,
  // so a future mount can fast-track past the min-days-since-install rule.
  // Never flipped back on immediately mid-session - see notifyPositiveAction.
  engagementThresholdMet?: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const useReviewPrompt = () => {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userReviewed, setUserReviewed] = useState(false);

  const checkShouldShowPrompt = async () => {
    try {
      const data = await browser.storage.sync.get(REVIEW_PROMPT_KEY);
      const now = Date.now();

      const reviewData: ReviewPromptData | undefined = data[REVIEW_PROMPT_KEY] as ReviewPromptData;

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

      setUserReviewed(reviewData.userReviewed);

      // Don't show if user already reviewed
      if (reviewData.userReviewed) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      // Check if user has been using extension for at least a few days,
      // unless a strong engagement signal already fast-tracked past this
      const daysSinceInstall = (now - reviewData.installDate) / DAY_MS;
      if (!reviewData.engagementThresholdMet && daysSinceInstall < REVIEW_PROMPT_MIN_DAYS_SINCE_INSTALL) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      // Re-show some time after an explicit dismiss, rather than never again
      if (reviewData.dismissed && reviewData.lastShownDate > 0) {
        const daysSinceLastShown = (now - reviewData.lastShownDate) / DAY_MS;
        if (daysSinceLastShown < REVIEW_PROMPT_DISMISS_COOLDOWN_DAYS) {
          setShouldShow(false);
          setLoading(false);
          return;
        }
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

  /**
   * Call after a positive in-app moment (e.g. a header was successfully
   * added). `engagementCount` is compared against
   * REVIEW_PROMPT_ENGAGEMENT_HEADER_THRESHOLD so a single early action
   * doesn't fast-track a brand new install.
   *
   * This only records the signal for the *next* time the prompt is
   * evaluated (the next popup open) - it deliberately never flips
   * `shouldShow` on mid-session, since that would pop a blocking dialog over
   * whatever the user is still actively doing (e.g. adding more headers).
   */
  const notifyPositiveAction = async (engagementCount: number) => {
    if (engagementCount < REVIEW_PROMPT_ENGAGEMENT_HEADER_THRESHOLD) {
      return;
    }

    try {
      const data = await browser.storage.sync.get(REVIEW_PROMPT_KEY);
      const reviewData: ReviewPromptData | undefined = data[REVIEW_PROMPT_KEY] as ReviewPromptData;

      if (!reviewData || reviewData.engagementThresholdMet) {
        return;
      }

      await browser.storage.sync.set({
        [REVIEW_PROMPT_KEY]: { ...reviewData, engagementThresholdMet: true },
      });
    } catch (error) {
      console.error("Error recording review prompt engagement:", error);
    }
  };

  /**
   * Opens the store review page and marks the user as reviewed - used by the
   * small persistent review nudge (footer/settings page), separate from the
   * dismissible modal's own review flow.
   */
  const openReviewPage = () => {
    const now = Date.now();

    browser.storage.sync.get(REVIEW_PROMPT_KEY).then((data) => {
      const reviewData: ReviewPromptData = (data[REVIEW_PROMPT_KEY] as ReviewPromptData) || {
        installDate: now,
        lastShownDate: now,
        userReviewed: false,
        dismissed: false,
      };

      browser.storage.sync.set({
        [REVIEW_PROMPT_KEY]: { ...reviewData, userReviewed: true, lastShownDate: now },
      });
    });

    browser.tabs.create({ url: REVIEWS_URL });
    setUserReviewed(true);
  };

  useEffect(() => {
    checkShouldShowPrompt();
  }, []);

  return {
    shouldShow,
    loading,
    hidePrompt,
    notifyPositiveAction,
    userReviewed,
    openReviewPage,
  };
};

export default useReviewPrompt;
