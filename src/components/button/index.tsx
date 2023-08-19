import "./index.css";

export interface ButtonProps {
  content: string | React.ReactElement;
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

export default Button;
