import Button from "../button";
import { REVIEW_PROMPT_KEY, REVIEWS_URL } from "../../constants";
import browser from "webextension-polyfill";
import "./index.css";

export interface ReviewPromptData {
  installDate: number;
  lastShownDate: number;
  userReviewed: boolean;
  dismissed: boolean;
}

interface ReviewPromptProps {
  onDismiss: () => void;
  onReview: () => void;
}

const ReviewPrompt = ({ onDismiss, onReview }: ReviewPromptProps) => {
  const handleDismiss = () => {
    // Update the last shown date to current time
    const now = Date.now();
    browser.storage.sync.get(REVIEW_PROMPT_KEY).then((data) => {
      const defaultData: ReviewPromptData = {
        installDate: now,
        lastShownDate: now,
        userReviewed: false,
        dismissed: false,
      };

      const reviewData: ReviewPromptData = (data[REVIEW_PROMPT_KEY] as ReviewPromptData) || defaultData;

      reviewData.lastShownDate = now;
      reviewData.dismissed = true;

      browser.storage.sync.set({ [REVIEW_PROMPT_KEY]: reviewData });
    });

    onDismiss();
  };

  const handleReview = () => {
    // Mark user as reviewed so they never see this again
    const now = Date.now();
    browser.storage.sync.get(REVIEW_PROMPT_KEY).then((data) => {
      const defaultData: ReviewPromptData = {
        installDate: now,
        lastShownDate: now,
        userReviewed: false,
        dismissed: false,
      };

      const reviewData: ReviewPromptData = (data[REVIEW_PROMPT_KEY] as ReviewPromptData) || defaultData;

      reviewData.userReviewed = true;
      reviewData.lastShownDate = now;

      browser.storage.sync.set({ [REVIEW_PROMPT_KEY]: reviewData });
    });

    browser.tabs.create({
      url: REVIEWS_URL,
    });

    onReview();
  };

  return (
    <div className="review-prompt">
      <div className="review-prompt__content">
        <h3>Enjoying FlexHeaders?</h3>
        <p>
          If you're finding FlexHeaders useful, would you mind taking a moment to leave a review?
          It helps other users discover the extension and motivates us to keep improving it.
        </p>
        <div className="review-prompt__buttons">
          <Button
            content="Dismiss"
            color="secondary"
            size="medium"
            onClick={handleDismiss}
          />
          <Button
            content="Review"
            color="primary"
            size="medium"
            onClick={handleReview}
          />
        </div>
      </div>
    </div>
  );
};

export default ReviewPrompt;