import { useEffect, useState } from "react";
import "./index.css";

export interface ButtonProps {
  content: string | React.ReactElement;
  intermediateContent?: string | React.ReactElement;
  size?: "small" | "medium" | "large";
  width?: "full" | "auto";
  onClick?: () => void;
}

const Button = ({
  content = "",
  size = "medium",
  width = "auto",
  onClick,
}: ButtonProps) => {
  return (
    <div className={`button ${size} width-${width}`} onClick={onClick}>
      {content}
    </div>
  );
};

export const FeedbackButton = ({
  content = "",
  size = "medium",
  width = "auto",
  onClick,
  intermediateContent = "",
}: ButtonProps) => {
  const [intermediate, setIntermediate] = useState(false);

  const _onClick = () => {
    setIntermediate(true);
    onClick && onClick();
  };

  useEffect(() => {
    if (intermediate) {
      setTimeout(() => {
        setIntermediate(false);
      }, 1000);
    }
  }, [intermediate]);

  return (
    <div className={`button ${size} width-${width}`} onClick={_onClick}>
      {intermediate ? intermediateContent : content}
    </div>
  );
};

export default Button;
