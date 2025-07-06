import { useEffect, useRef } from "react";
import Button from "../button";
import browser from "webextension-polyfill";
import "./index.css";

interface ReviewPromptProps {
  show: boolean;
  onClose: () => void;
}

const ReviewPrompt = ({ show, onClose }: ReviewPromptProps) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, onClose]);

  const openReviewPage = () => {
    const url = `https://chrome.google.com/webstore/detail/${browser.runtime.id}`;
    browser.tabs.create({ url });
    onClose();
  };

  return (
    <>
      <div className={`review-prompt__backdrop ${show ? "show" : ""}`}></div>
      <div className={`review-prompt ${show ? "show" : ""}`} ref={popupRef}>
        <div className="review-prompt__title">
          <h2>Enjoying Flex Headers?</h2>
        </div>
        <div className="review-prompt__body">
          <p>
            If you find this extension helpful, please consider leaving a review
            on the Chrome Web Store. Your feedback really helps others discover
            it.
          </p>
        </div>
        <div className="review-prompt__actions">
          <Button content="Later" onClick={onClose} color="secondary" />
          <Button content="Leave a Review" onClick={openReviewPage} />
        </div>
      </div>
    </>
  );
};

export default ReviewPrompt;
